package router_test

import (
	"context"
	"fmt"
	"net/http"
	"reflect"
	"sort"
	"testing"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/models"
	"golf-maintenance/backend/internal/router"
	"golf-maintenance/backend/internal/testutil"
)

func createUserBody(email, jobTitle string) string {
	return fmt.Sprintf(
		`{"email":%q,"password":"password123","full_name":"New Person","job_title":%q}`,
		email, jobTitle,
	)
}

func storedRoleAndTitle(t *testing.T, email string) (string, string) {
	t.Helper()
	var role, jobTitle string
	err := db.Pool.QueryRow(
		context.Background(),
		`SELECT role, job_title::text FROM users WHERE email = $1`,
		email,
	).Scan(&role, &jobTitle)
	if err != nil {
		t.Fatalf("could not load user %s: %v", email, err)
	}
	return role, jobTitle
}

func TestCreateUser_DerivesRoleFromJobTitle(t *testing.T) {
	testutil.SetupTestDB(t)
	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	adminCookie := testutil.SessionCookie(t, adminID)
	handler := router.New()

	// Written out independently of the Go map, so the test checks the business rule itself
	testCases := []struct {
		jobTitle     string
		expectedRole string
	}{
		{"superintendent", "admin"},
		{"assistant_superintendent", "admin"},
		{"master_mechanic", "admin"},
		{"operator", "staff"},
		{"gardener", "staff"},
		{"landscaper", "staff"},
		{"mechanic", "staff"},
		{"office_admin", "staff"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.jobTitle, func(t *testing.T) {
			email := testCase.jobTitle + "@example.com"
			recorder := sendRequest(handler, http.MethodPost, "/users",
				createUserBody(email, testCase.jobTitle), adminCookie)

			if recorder.Code != http.StatusCreated {
				t.Fatalf("expected 201, got %d (body: %s)", recorder.Code, recorder.Body.String())
			}

			role, jobTitle := storedRoleAndTitle(t, email)
			if role != testCase.expectedRole {
				t.Errorf("expected role %q, got %q", testCase.expectedRole, role)
			}
			if jobTitle != testCase.jobTitle {
				t.Errorf("expected job title %q, got %q", testCase.jobTitle, jobTitle)
			}
		})
	}
}

func TestCreateUser_IgnoresRoleSentByClient(t *testing.T) {
	testutil.SetupTestDB(t)
	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	adminCookie := testutil.SessionCookie(t, adminID)
	handler := router.New()

	body := `{"email":"sneaky@example.com","password":"password123","full_name":"Sneaky","job_title":"landscaper","role":"admin"}`
	recorder := sendRequest(handler, http.MethodPost, "/users", body, adminCookie)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	role, _ := storedRoleAndTitle(t, "sneaky@example.com")
	if role != "staff" {
		t.Errorf("a landscaper must be staff no matter what the request says, got %q", role)
	}
}

func countUsers(t *testing.T) int {
	t.Helper()
	var count int
	err := db.Pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM users`).Scan(&count)
	if err != nil {
		t.Fatalf("could not count users: %v", err)
	}
	return count
}

func TestCreateUser_RejectsMissingOrInvalidJobTitle(t *testing.T) {
	testutil.SetupTestDB(t)
	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	adminCookie := testutil.SessionCookie(t, adminID)
	handler := router.New()

	testCases := []struct {
		name     string
		jobTitle string
	}{
		{"missing job title", ""},
		{"unknown job title", "janitor"},
		{"wrong capitalization", "Superintendent"},
		{"display label instead of stored value", "Master Mechanic"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := sendRequest(handler, http.MethodPost, "/users",
				createUserBody("new@example.com", testCase.jobTitle), adminCookie)

			if recorder.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d (body: %s)", recorder.Code, recorder.Body.String())
			}
		})
	}

	// Only the admin created by the test setup should exist
	if count := countUsers(t); count != 1 {
		t.Errorf("rejected requests must not create users, found %d total", count)
	}
}

func TestMe_ReturnsJobTitle(t *testing.T) {
	testutil.SetupTestDB(t)
	userID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	cookie := testutil.SessionCookie(t, userID)
	handler := router.New()

	// A user created before job titles existed has none
	recorder := sendRequest(handler, http.MethodGet, "/me", "", cookie)
	profile := decodeJSONObject(t, recorder.Body.Bytes())
	value, present := profile["job_title"]
	if !present || value != nil {
		t.Errorf("expected job_title to be present and null, got %v (present: %v)", value, present)
	}

	_, err := db.Pool.Exec(
		context.Background(),
		`UPDATE users SET job_title = 'mechanic' WHERE id = $1`,
		userID,
	)
	if err != nil {
		t.Fatalf("could not set job title: %v", err)
	}

	recorder = sendRequest(handler, http.MethodGet, "/me", "", cookie)
	profile = decodeJSONObject(t, recorder.Body.Bytes())
	if profile["job_title"] != "mechanic" {
		t.Errorf("expected job_title mechanic, got %v", profile["job_title"])
	}
}

func TestJobTitles_GoMapMatchesDatabaseEnum(t *testing.T) {
	testutil.SetupTestDB(t)

	rows, err := db.Pool.Query(
		context.Background(),
		`SELECT unnest(enum_range(NULL::job_title_type))::text`,
	)
	if err != nil {
		t.Fatalf("could not read enum values: %v", err)
	}
	defer rows.Close()

	var databaseTitles []string
	for rows.Next() {
		var jobTitle string
		if err := rows.Scan(&jobTitle); err != nil {
			t.Fatalf("could not scan enum value: %v", err)
		}
		databaseTitles = append(databaseTitles, jobTitle)
	}

	goTitles := models.JobTitles()
	sort.Strings(databaseTitles)
	sort.Strings(goTitles)

	if !reflect.DeepEqual(databaseTitles, goTitles) {
		t.Errorf("database enum and Go map have drifted apart.\ndatabase: %v\ngo map:   %v",
			databaseTitles, goTitles)
	}
}

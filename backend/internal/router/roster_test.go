package router_test

import (
	"context"
	"net/http"
	"reflect"
	"sort"
	"strings"
	"testing"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/router"
	"golf-maintenance/backend/internal/testutil"
)

// Test data
const (
	adminName = "Zed Admin"
	caseyName = "Casey Brooks"
	alexName  = "Alex Rivera"
	alexTitle = "mechanic"
)

func setFullName(t *testing.T, userID, fullName string) {
	t.Helper()
	_, err := db.Pool.Exec(
		context.Background(),
		`UPDATE users SET full_name = $1 WHERE id = $2`,
		fullName, userID,
	)
	if err != nil {
		t.Fatalf("could not set name: %v", err)
	}
}

func setJobTitle(t *testing.T, userID, jobTitle string) {
	t.Helper()
	_, err := db.Pool.Exec(
		context.Background(),
		`UPDATE users SET job_title = $1 WHERE id = $2`,
		jobTitle, userID,
	)
	if err != nil {
		t.Fatalf("could not set job title: %v", err)
	}
}

func TestRoster_ListsOnlyStaffSortedByName(t *testing.T) {
	testutil.SetupTestDB(t)
	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	caseyID := testutil.CreateUser(t, "casey@example.com", "password123", "staff")
	alexID := testutil.CreateUser(t, "alex@example.com", "password123", "staff")
	setFullName(t, adminID, adminName)
	setFullName(t, caseyID, caseyName)
	setFullName(t, alexID, alexName)
	adminCookie := testutil.SessionCookie(t, adminID)
	handler := router.New()

	// No shifts exist anywhere: staff still get a row on the roster
	recorder := sendRequest(handler, http.MethodGet, "/api/roster", "", adminCookie)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}

	names := []string{}
	for _, member := range decodeJSONList(t, recorder.Body.Bytes()) {
		name, _ := member["full_name"].(string)
		names = append(names, name)
	}
	expectedNames := []string{alexName, caseyName}
	if !reflect.DeepEqual(names, expectedNames) {
		t.Errorf("expected %v (staff only, sorted), got %v", expectedNames, names)
	}
}

func TestRoster_ExposesOnlyIdNameAndTitle(t *testing.T) {
	testutil.SetupTestDB(t)
	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	caseyID := testutil.CreateUser(t, "casey@example.com", "password123", "staff")
	alexID := testutil.CreateUser(t, "alex@example.com", "password123", "staff")
	setFullName(t, caseyID, caseyName)
	setFullName(t, alexID, alexName)
	setJobTitle(t, alexID, alexTitle)
	adminCookie := testutil.SessionCookie(t, adminID)
	handler := router.New()

	recorder := sendRequest(handler, http.MethodGet, "/api/roster", "", adminCookie)

	roster := decodeJSONList(t, recorder.Body.Bytes())
	if len(roster) != 2 {
		t.Fatalf("expected 2 staff members, got %d", len(roster))
	}

	expectedKeys := []string{"full_name", "id", "job_title"}
	for _, member := range roster {
		keys := []string{}
		for key := range member {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		if !reflect.DeepEqual(keys, expectedKeys) {
			t.Errorf("roster must expose only %v, got %v", expectedKeys, keys)
		}

		switch member["full_name"] {
		case alexName:
			if member["job_title"] != alexTitle {
				t.Errorf("expected %s to have title %q, got %v", alexName, alexTitle, member["job_title"])
			}
		case caseyName:
			if member["job_title"] != nil {
				t.Errorf("expected %s to have a null title, got %v", caseyName, member["job_title"])
			}
		}
	}
}

func TestRoster_AvailableToAnyLoggedInUser(t *testing.T) {
	testutil.SetupTestDB(t)
	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	adminCookie := testutil.SessionCookie(t, adminID)
	staffCookie := testutil.SessionCookie(t, staffID)
	handler := router.New()

	testCases := []struct {
		name           string
		cookie         *http.Cookie
		expectedStatus int
	}{
		{"no session", nil, http.StatusUnauthorized},
		{"staff user", staffCookie, http.StatusOK},
		{"admin user", adminCookie, http.StatusOK},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := sendRequest(handler, http.MethodGet, "/api/roster", "", testCase.cookie)
			if recorder.Code != testCase.expectedStatus {
				t.Errorf("expected %d, got %d", testCase.expectedStatus, recorder.Code)
			}
		})
	}
}

func TestRoster_IsAnEmptyListNotNullWhenThereIsNoStaff(t *testing.T) {
	testutil.SetupTestDB(t)
	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	adminCookie := testutil.SessionCookie(t, adminID)
	handler := router.New()

	recorder := sendRequest(handler, http.MethodGet, "/api/roster", "", adminCookie)

	// The frontend calls .map on this, and null.map would crash it
	if body := strings.TrimSpace(recorder.Body.String()); body != "[]" {
		t.Errorf("expected an empty list, got %q", body)
	}
}

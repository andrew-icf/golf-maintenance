package router_test

import (
	"context"
	"net/http"
	"reflect"
	"sort"
	"strings"
	"testing"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/testutil"
)

// Test data
const (
	adminName = "Zed Admin"
	caseyName = "Casey Brooks"
	alexName  = "Alex Rivera"
	alexTitle = "mechanic"
)

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
	admin := setUpAdmin(t)
	setFullName(t, admin.id, adminName)
	newNamedPerson(t, "casey@example.com", "staff", caseyName)
	newNamedPerson(t, "alex@example.com", "staff", alexName)

	// No shifts exist anywhere: staff still get a row on the roster
	recorder := sendRequest(admin.handler, http.MethodGet, "/api/roster", "", admin.cookie)

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
	admin := setUpAdmin(t)
	newNamedPerson(t, "casey@example.com", "staff", caseyName)
	alex := newNamedPerson(t, "alex@example.com", "staff", alexName)
	setJobTitle(t, alex.id, alexTitle)

	recorder := sendRequest(admin.handler, http.MethodGet, "/api/roster", "", admin.cookie)

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

func TestRoster_AvailableToAnyUserOnTheClock(t *testing.T) {
	admin := setUpAdmin(t)
	staff := newPerson(t, "staff@example.com", "staff")
	testutil.ClockIn(t, staff.id)

	testCases := []struct {
		name           string
		cookie         *http.Cookie
		expectedStatus int
	}{
		{"no session", nil, http.StatusUnauthorized},
		{"staff user on the clock", staff.cookie, http.StatusOK},
		{"admin user", admin.cookie, http.StatusOK},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := sendRequest(admin.handler, http.MethodGet, "/api/roster", "", testCase.cookie)
			if recorder.Code != testCase.expectedStatus {
				t.Errorf("expected %d, got %d", testCase.expectedStatus, recorder.Code)
			}
		})
	}
}

func TestRoster_IsAnEmptyListNotNullWhenThereIsNoStaff(t *testing.T) {
	admin := setUpAdmin(t)

	recorder := sendRequest(admin.handler, http.MethodGet, "/api/roster", "", admin.cookie)

	// The frontend calls .map on this, and null.map would crash it
	if body := strings.TrimSpace(recorder.Body.String()); body != "[]" {
		t.Errorf("expected an empty list, got %q", body)
	}
}

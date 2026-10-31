package router_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/router"
	"golf-maintenance/backend/internal/testutil"
)

// Every helper shared by more than one test file lives here, in sections, so any of them is
// easy to find. A helper used by only one file stays at the top of that file.

// ---- Sending requests and reading responses ----

func sendRequest(handler http.Handler, method, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		request.AddCookie(cookie)
	}

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

func decodeJSONObject(t *testing.T, responseBody []byte) map[string]any {
	t.Helper()
	var decoded map[string]any
	if err := json.Unmarshal(responseBody, &decoded); err != nil {
		t.Fatalf("could not decode response %q: %v", string(responseBody), err)
	}
	return decoded
}

func decodeJSONList(t *testing.T, responseBody []byte) []map[string]any {
	t.Helper()
	var decoded []map[string]any
	if err := json.Unmarshal(responseBody, &decoded); err != nil {
		t.Fatalf("could not decode response %q: %v", string(responseBody), err)
	}
	return decoded
}

// ---- People and sessions ----

// A person in the test database, with a session so a test can send requests as them
type testPerson struct {
	id     string
	cookie *http.Cookie
}

func newPerson(t *testing.T, email, role string) testPerson {
	t.Helper()
	userID := testutil.CreateUser(t, email, "password123", role)
	return testPerson{id: userID, cookie: testutil.SessionCookie(t, userID)}
}

func newNamedPerson(t *testing.T, email, role, fullName string) testPerson {
	t.Helper()
	person := newPerson(t, email, role)
	setFullName(t, person.id, fullName)
	return person
}

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

// A signed-in person together with a router, ready to send requests
type signedIn struct {
	testPerson
	handler http.Handler
}

// Go has no beforeEach, so a test calls ONE of these three first. Each wipes the database,
// so anything else the test needs (more people, a club, shifts) is added after it. Calling
// two of them in one test would wipe the first.
func setUpStaff(t *testing.T) signedIn {
	t.Helper()
	testutil.SetupTestDB(t)
	return signedIn{testPerson: newPerson(t, "staff@example.com", "staff"), handler: router.New()}
}

func setUpClockedInStaff(t *testing.T) signedIn {
	t.Helper()
	staff := setUpStaff(t)
	testutil.ClockIn(t, staff.id)
	return staff
}

// Admins are exempt from the clock rule, so there is no clocked-in version of this
func setUpAdmin(t *testing.T) signedIn {
	t.Helper()
	testutil.SetupTestDB(t)
	return signedIn{testPerson: newPerson(t, "admin@example.com", "admin"), handler: router.New()}
}

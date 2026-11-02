package router_test

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/testutil"
)

// Test data. newPerson gives everyone the same starting password.
const (
	changePasswordPath  = "/api/change-password"
	existingPassword    = "password123"
	replacementPassword = "tatooine-sunset-42"
	staffLoginEmail     = "staff@example.com"
	adminLoginEmail     = "admin@example.com"
	otherLoginEmail     = "other.staff@example.com"
	wrongCurrentMessage = "current password is incorrect"
)

// People who may change their password, each set up the way a test begins
var anyoneLoggedIn = []struct {
	name  string
	email string
	setUp func(t *testing.T) signedIn
}{
	{"staff who are not clocked in", staffLoginEmail, setUpStaff},
	{"staff who are clocked in", staffLoginEmail, setUpClockedInStaff},
	{"an admin", adminLoginEmail, setUpAdmin},
}

var incompleteRequests = []struct {
	name string
	body string
}{
	{"no current password", changePasswordBody("", replacementPassword)},
	{"no new password", changePasswordBody(existingPassword, "")},
	{"neither password", changePasswordBody("", "")},
	{"an empty object", `{}`},
	{"not valid JSON", `not json`},
}

// Replacements that break the rules, with a piece of the message each should get. The rules
// themselves are tested one by one in the auth package, so this proves they are wired in.
var refusedReplacements = []struct {
	name         string
	replacement  string
	expectedText string
}{
	{"too short", "abc1234", "at least 8 characters"},
	{"too long", strings.Repeat("a", 73), "too long"},
	{"only spaces", strings.Repeat(" ", 10), "only spaces"},
	{"the same as the current password", existingPassword, "different from the current password"},
}

var acceptedReplacements = []struct {
	name        string
	replacement string
}{
	{"eight characters", "abcd1234"},
	{"exactly 72 bytes", strings.Repeat("a", 72)},
	{"a passphrase with spaces", "correct horse battery"},
	{"the current password in another case", "Password123"},
}

// Actions
func changePasswordBody(current, replacement string) string {
	body, _ := json.Marshal(map[string]string{"current_password": current, "new_password": replacement})
	return string(body)
}

func expectLogin(t *testing.T, handler http.Handler, email, password string, expectedStatus int) {
	t.Helper()
	if status := loginStatus(handler, email, password); status != expectedStatus {
		t.Errorf("logging in as %s with %q: expected %d, got %d", email, password, expectedStatus, status)
	}
}

func meStatus(handler http.Handler, cookie *http.Cookie) int {
	return sendRequest(handler, http.MethodGet, "/me", "", cookie).Code
}

func storedPasswordHash(t *testing.T, userID string) string {
	t.Helper()
	var hash string
	err := db.Pool.QueryRow(
		context.Background(),
		`SELECT password_hash FROM users WHERE id = $1`,
		userID,
	).Scan(&hash)
	if err != nil {
		t.Fatalf("could not load password hash: %v", err)
	}
	return hash
}

func TestChangePassword_RequiresASession(t *testing.T) {
	staff := setUpStaff(t)

	recorder := sendRequest(staff.handler, http.MethodPost, changePasswordPath,
		changePasswordBody(existingPassword, replacementPassword), nil)

	if recorder.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", recorder.Code)
	}
	expectLogin(t, staff.handler, staffLoginEmail, existingPassword, http.StatusOK)
}

func TestChangePassword_ReplacesThePassword(t *testing.T) {
	staff := setUpStaff(t)

	recorder := sendRequest(staff.handler, http.MethodPost, changePasswordPath,
		changePasswordBody(existingPassword, replacementPassword), staff.cookie)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	expectLogin(t, staff.handler, staffLoginEmail, replacementPassword, http.StatusOK)
	expectLogin(t, staff.handler, staffLoginEmail, existingPassword, http.StatusUnauthorized)
}

func TestChangePassword_WorksForAnyoneLoggedIn(t *testing.T) {
	for _, situation := range anyoneLoggedIn {
		t.Run(situation.name, func(t *testing.T) {
			person := situation.setUp(t)

			recorder := sendRequest(person.handler, http.MethodPost, changePasswordPath,
				changePasswordBody(existingPassword, replacementPassword), person.cookie)

			if recorder.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
			}
			expectLogin(t, person.handler, situation.email, replacementPassword, http.StatusOK)
		})
	}
}

func TestChangePassword_RefusesAWrongCurrentPassword(t *testing.T) {
	staff := setUpStaff(t)

	recorder := sendRequest(staff.handler, http.MethodPost, changePasswordPath,
		changePasswordBody("not-my-password", replacementPassword), staff.cookie)

	body := strings.TrimSpace(recorder.Body.String())
	if recorder.Code != http.StatusForbidden || body != wrongCurrentMessage {
		t.Errorf("expected 403 %q, got %d %q", wrongCurrentMessage, recorder.Code, body)
	}
	expectLogin(t, staff.handler, staffLoginEmail, existingPassword, http.StatusOK)
	expectLogin(t, staff.handler, staffLoginEmail, replacementPassword, http.StatusUnauthorized)
}

func TestChangePassword_RefusesIncompleteRequests(t *testing.T) {
	staff := setUpStaff(t)

	for _, testCase := range incompleteRequests {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := sendRequest(staff.handler, http.MethodPost, changePasswordPath, testCase.body, staff.cookie)

			if recorder.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d (body: %s)", recorder.Code, recorder.Body.String())
			}
		})
	}

	expectLogin(t, staff.handler, staffLoginEmail, existingPassword, http.StatusOK)
}

func TestChangePassword_RefusesAPasswordThatBreaksTheRules(t *testing.T) {
	staff := setUpStaff(t)

	for _, testCase := range refusedReplacements {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := sendRequest(staff.handler, http.MethodPost, changePasswordPath,
				changePasswordBody(existingPassword, testCase.replacement), staff.cookie)

			body := recorder.Body.String()
			if recorder.Code != http.StatusBadRequest || !strings.Contains(body, testCase.expectedText) {
				t.Errorf("expected 400 mentioning %q, got %d %q", testCase.expectedText, recorder.Code, body)
			}
		})
	}

	expectLogin(t, staff.handler, staffLoginEmail, existingPassword, http.StatusOK)
}

func TestChangePassword_AcceptsPasswordsAtTheLimits(t *testing.T) {
	for _, testCase := range acceptedReplacements {
		t.Run(testCase.name, func(t *testing.T) {
			staff := setUpStaff(t)

			recorder := sendRequest(staff.handler, http.MethodPost, changePasswordPath,
				changePasswordBody(existingPassword, testCase.replacement), staff.cookie)

			if recorder.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
			}
			expectLogin(t, staff.handler, staffLoginEmail, testCase.replacement, http.StatusOK)
		})
	}
}

func TestChangePassword_SignsOutTheOtherSessionsButNotThisOne(t *testing.T) {
	staff := setUpStaff(t)
	phoneCookie := testutil.SessionCookie(t, staff.id)
	tabletCookie := testutil.SessionCookie(t, staff.id)
	otherPerson := newPerson(t, otherLoginEmail, "staff")

	recorder := sendRequest(staff.handler, http.MethodPost, changePasswordPath,
		changePasswordBody(existingPassword, replacementPassword), staff.cookie)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	if status := meStatus(staff.handler, staff.cookie); status != http.StatusOK {
		t.Errorf("this session should stay signed in, got %d", status)
	}
	for name, cookie := range map[string]*http.Cookie{"phone": phoneCookie, "tablet": tabletCookie} {
		if status := meStatus(staff.handler, cookie); status != http.StatusUnauthorized {
			t.Errorf("the session on the %s should be signed out, got %d", name, status)
		}
	}
	if status := meStatus(staff.handler, otherPerson.cookie); status != http.StatusOK {
		t.Errorf("another person's session must not be touched, got %d", status)
	}
}

func TestChangePassword_OnlyChangesYourOwnPassword(t *testing.T) {
	staff := setUpStaff(t)
	newPerson(t, otherLoginEmail, "staff")

	recorder := sendRequest(staff.handler, http.MethodPost, changePasswordPath,
		changePasswordBody(existingPassword, replacementPassword), staff.cookie)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	expectLogin(t, staff.handler, otherLoginEmail, existingPassword, http.StatusOK)
	expectLogin(t, staff.handler, staffLoginEmail, existingPassword, http.StatusUnauthorized)
}

func TestChangePassword_StoresAHashNotThePassword(t *testing.T) {
	staff := setUpStaff(t)
	hashBefore := storedPasswordHash(t, staff.id)

	sendRequest(staff.handler, http.MethodPost, changePasswordPath,
		changePasswordBody(existingPassword, replacementPassword), staff.cookie)

	hashAfter := storedPasswordHash(t, staff.id)
	if hashAfter == hashBefore {
		t.Errorf("the stored hash should have changed")
	}
	if hashAfter == replacementPassword {
		t.Errorf("the password must never be stored as written")
	}
	if !strings.HasPrefix(hashAfter, "$2") {
		t.Errorf("expected a bcrypt hash, got %q", hashAfter)
	}
}

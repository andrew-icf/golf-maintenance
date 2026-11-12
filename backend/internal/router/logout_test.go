package router_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"golf-maintenance/backend/internal/testutil"
)

// ---- Helpers ----

func sessionExists(t *testing.T, token string) bool {
	t.Helper()
	return countRows(t, `SELECT COUNT(*) FROM sessions WHERE token = $1`, token) == 1
}

// Fails unless the response tells the browser to drop its session cookie
func expectSessionCookieCleared(t *testing.T, recorder *httptest.ResponseRecorder) {
	t.Helper()
	for _, cookie := range recorder.Result().Cookies() {
		if cookie.Name != "session_token" {
			continue
		}
		if cookie.Value != "" {
			t.Errorf("expected an empty session cookie, got %q", cookie.Value)
		}
		if !cookie.Expires.Before(time.Now()) {
			t.Errorf("expected the session cookie to expire in the past, got %v", cookie.Expires)
		}
		return
	}
	t.Error("expected a session_token cookie that clears the session")
}

// ---- Tests ----

func TestLogout_EndsTheSessionOnTheServer(t *testing.T) {
	staff := setUpStaff(t)

	recorder := sendRequest(staff.handler, http.MethodPost, "/logout", "", staff.cookie)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	expectSessionCookieCleared(t, recorder)
	if sessionExists(t, staff.cookie.Value) {
		t.Error("the session row must be deleted")
	}

	// A copy of the old cookie must no longer work
	if code := sendRequest(staff.handler, http.MethodGet, "/me", "", staff.cookie).Code; code != http.StatusUnauthorized {
		t.Errorf("expected 401 with the old cookie, got %d", code)
	}
}

// Logging out on one tablet leaves the same person signed in on another
func TestLogout_LeavesOtherSessionsAlone(t *testing.T) {
	staff := setUpStaff(t)
	otherTablet := testutil.SessionCookie(t, staff.id)

	sendRequest(staff.handler, http.MethodPost, "/logout", "", staff.cookie)

	if !sessionExists(t, otherTablet.Value) {
		t.Error("the other session must survive")
	}
	if code := sendRequest(staff.handler, http.MethodGet, "/me", "", otherTablet).Code; code != http.StatusOK {
		t.Errorf("expected 200 with the other session, got %d", code)
	}
}

func TestLogout_WithoutASessionStillClearsTheCookie(t *testing.T) {
	staff := setUpStaff(t)

	recorder := sendRequest(staff.handler, http.MethodPost, "/logout", "", nil)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	expectSessionCookieCleared(t, recorder)
	if !sessionExists(t, staff.cookie.Value) {
		t.Error("a logout with no cookie must not end anyone's session")
	}
}

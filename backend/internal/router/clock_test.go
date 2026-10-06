package router_test

import (
	"net/http"
	"testing"

	"golf-maintenance/backend/internal/router"
	"golf-maintenance/backend/internal/testutil"
)

func TestClock_RequiresSession(t *testing.T) {
	testutil.SetupTestDB(t)
	handler := router.New()

	for _, path := range []string{"/clock-in", "/clock-out"} {
		recorder := sendRequest(handler, http.MethodPost, path, "", nil)
		if recorder.Code != http.StatusUnauthorized {
			t.Errorf("%s without a session: expected 401, got %d", path, recorder.Code)
		}
	}
}

func TestClock_EnforcesStateRules(t *testing.T) {
	testutil.SetupTestDB(t)
	userID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	cookie := testutil.SessionCookie(t, userID)
	handler := router.New()

	// Each step builds on the previous one, so the order matters.
	steps := []struct {
		description    string
		path           string
		expectedStatus int
	}{
		{"clock out before clocking in", "/clock-out", http.StatusConflict},
		{"clock in", "/clock-in", http.StatusCreated},
		{"clock in again while clocked in", "/clock-in", http.StatusConflict},
		{"clock out", "/clock-out", http.StatusOK},
		{"clock out again", "/clock-out", http.StatusConflict},
		{"clock in on a new shift", "/clock-in", http.StatusCreated},
	}

	for _, step := range steps {
		recorder := sendRequest(handler, http.MethodPost, step.path, "", cookie)
		if recorder.Code != step.expectedStatus {
			t.Fatalf("%s: expected %d, got %d (body: %s)",
				step.description, step.expectedStatus, recorder.Code, recorder.Body.String())
		}
	}
}

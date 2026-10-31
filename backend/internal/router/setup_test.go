package router_test

import (
	"net/http"
	"testing"

	"golf-maintenance/backend/internal/router"
	"golf-maintenance/backend/internal/testutil"
)

// A staff member who is on the clock, with a session and a router, on a freshly cleaned
// database. Go has no beforeEach, so each test that needs this calls it first.
type clockedInStaff struct {
	id      string
	cookie  *http.Cookie
	handler http.Handler
}

func setUpClockedInStaff(t *testing.T) clockedInStaff {
	t.Helper()
	testutil.SetupTestDB(t)
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	testutil.ClockIn(t, staffID)

	return clockedInStaff{
		id:      staffID,
		cookie:  testutil.SessionCookie(t, staffID),
		handler: router.New(),
	}
}

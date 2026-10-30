package router_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"golf-maintenance/backend/internal/auth"
	"golf-maintenance/backend/internal/router"
	"golf-maintenance/backend/internal/testutil"
)

// Test data
const (
	gateStaffEmail      = "staff@example.com"
	gateOtherStaffEmail = "other.staff@example.com"
	gateAdminEmail      = "admin@example.com"
	gatePassword        = "password123"
	forbiddenRoleText   = "insufficient permissions"
)

type gateRequest struct {
	label  string
	method string
	path   string
	body   string
}

var equipmentListRequest = gateRequest{"view equipment", http.MethodGet, "/api/equipment", ""}

// Routes for people on the clock. Staff are refused until they clock in, and admins are exempt.
var gatedRoutes = []gateRequest{
	{"view the course", http.MethodGet, "/api/course", ""},
	equipmentListRequest,
	{"update equipment", http.MethodPut, "/api/equipment/" + nonexistentID, `{"status":"working_order"}`},
	{"view the schedule", http.MethodGet, "/api/schedule", ""},
	{"view the roster", http.MethodGet, "/api/roster", ""},
}

// Routes only admins may use. Their own role rule comes first, so the clock rule never applies.
var adminOnlyRoutes = []gateRequest{
	{"list users", http.MethodGet, "/api/users", ""},
	{"add a shift", http.MethodPost, "/api/schedule", "{}"},
	{"repeat shifts", http.MethodPost, "/api/schedule/repeat", "{}"},
	{"edit a shift", http.MethodPut, "/api/schedule/" + nonexistentID, "{}"},
	{"delete shifts", http.MethodDelete, "/api/schedule", `{"ids":[]}`},
}

// Routes open to anyone logged in, tried in order by someone who is not clocked in
var openRouteSteps = []struct {
	label          string
	method         string
	path           string
	expectedStatus int
}{
	{"check who is logged in", http.MethodGet, "/me", http.StatusOK},
	{"clock out when not clocked in", http.MethodPost, "/clock-out", http.StatusConflict},
	{"clock in", http.MethodPost, "/clock-in", http.StatusCreated},
}

// Scenarios
type gateUser struct {
	id     string
	cookie *http.Cookie
}

func newGateUser(t *testing.T, email, role string) gateUser {
	t.Helper()
	userID := testutil.CreateUser(t, email, gatePassword, role)
	return gateUser{id: userID, cookie: testutil.SessionCookie(t, userID)}
}

// Actions
func sendAs(handler http.Handler, user gateUser, request gateRequest) *httptest.ResponseRecorder {
	return sendRequest(handler, request.method, request.path, request.body, user.cookie)
}

func expectClockInRefusal(t *testing.T, request gateRequest, recorder *httptest.ResponseRecorder) {
	t.Helper()
	body := strings.TrimSpace(recorder.Body.String())

	if recorder.Code != http.StatusForbidden || body != auth.ClockInRequiredMessage {
		t.Errorf("%s: expected 403 %q, got %d %q",
			request.label, auth.ClockInRequiredMessage, recorder.Code, body)
	}
}

// Getting past the gate means the route's own handler ran. What it answers is covered in each
// route's own tests, so all this checks is that the person was not turned away.
func expectPastTheGate(t *testing.T, request gateRequest, recorder *httptest.ResponseRecorder) {
	t.Helper()

	if recorder.Code == http.StatusUnauthorized || recorder.Code == http.StatusForbidden {
		t.Errorf("%s: expected to get through, got %d %q",
			request.label, recorder.Code, strings.TrimSpace(recorder.Body.String()))
	}
}

func TestClockGate_RequiresASessionFirst(t *testing.T) {
	testutil.SetupTestDB(t)
	handler := router.New()

	for _, request := range gatedRoutes {
		recorder := sendRequest(handler, request.method, request.path, request.body, nil)

		if recorder.Code != http.StatusUnauthorized {
			t.Errorf("%s without a session: expected 401, got %d", request.label, recorder.Code)
		}
	}
}

func TestClockGate_RefusesStaffWhoAreNotClockedIn(t *testing.T) {
	testutil.SetupTestDB(t)
	staff := newGateUser(t, gateStaffEmail, "staff")
	handler := router.New()

	for _, request := range gatedRoutes {
		expectClockInRefusal(t, request, sendAs(handler, staff, request))
	}
}

func TestClockGate_LetsClockedInStaffThrough(t *testing.T) {
	testutil.SetupTestDB(t)
	staff := newGateUser(t, gateStaffEmail, "staff")
	testutil.ClockIn(t, staff.id)
	handler := router.New()

	for _, request := range gatedRoutes {
		expectPastTheGate(t, request, sendAs(handler, staff, request))
	}
}

func TestClockGate_RefusesStaffAgainAfterClockingOut(t *testing.T) {
	testutil.SetupTestDB(t)
	staff := newGateUser(t, gateStaffEmail, "staff")
	testutil.ClockIn(t, staff.id)
	testutil.ClockOut(t, staff.id)
	handler := router.New()

	for _, request := range gatedRoutes {
		expectClockInRefusal(t, request, sendAs(handler, staff, request))
	}
}

func TestClockGate_ExemptsAdminsWhoAreNotClockedIn(t *testing.T) {
	testutil.SetupTestDB(t)
	admin := newGateUser(t, gateAdminEmail, "admin")
	handler := router.New()

	for _, request := range gatedRoutes {
		expectPastTheGate(t, request, sendAs(handler, admin, request))
	}
}

func TestClockGate_OnlyCountsYourOwnClockEntry(t *testing.T) {
	testutil.SetupTestDB(t)
	staff := newGateUser(t, gateStaffEmail, "staff")
	otherStaff := newGateUser(t, gateOtherStaffEmail, "staff")
	testutil.ClockIn(t, otherStaff.id)
	handler := router.New()

	for _, request := range gatedRoutes {
		expectClockInRefusal(t, request, sendAs(handler, staff, request))
		expectPastTheGate(t, request, sendAs(handler, otherStaff, request))
	}
}

func TestClockGate_TakesEffectOnTheNextRequest(t *testing.T) {
	testutil.SetupTestDB(t)
	staff := newGateUser(t, gateStaffEmail, "staff")
	handler := router.New()
	clockIn := gateRequest{"clock in", http.MethodPost, "/clock-in", ""}
	clockOut := gateRequest{"clock out", http.MethodPost, "/clock-out", ""}

	expectClockInRefusal(t, equipmentListRequest, sendAs(handler, staff, equipmentListRequest))

	if recorder := sendAs(handler, staff, clockIn); recorder.Code != http.StatusCreated {
		t.Fatalf("clock in: expected 201, got %d", recorder.Code)
	}
	expectPastTheGate(t, equipmentListRequest, sendAs(handler, staff, equipmentListRequest))

	if recorder := sendAs(handler, staff, clockOut); recorder.Code != http.StatusOK {
		t.Fatalf("clock out: expected 200, got %d", recorder.Code)
	}
	expectClockInRefusal(t, equipmentListRequest, sendAs(handler, staff, equipmentListRequest))
}

func TestClockGate_LeavesTheOpenRoutesOpen(t *testing.T) {
	testutil.SetupTestDB(t)
	staff := newGateUser(t, gateStaffEmail, "staff")
	handler := router.New()

	// Each step builds on the previous one: clocking out before clocking in has to come first
	for _, step := range openRouteSteps {
		recorder := sendRequest(handler, step.method, step.path, "", staff.cookie)

		if recorder.Code != step.expectedStatus {
			t.Fatalf("%s: expected %d, got %d (body: %s)",
				step.label, step.expectedStatus, recorder.Code, recorder.Body.String())
		}
	}

	if recorder := sendRequest(handler, http.MethodGet, "/health", "", nil); recorder.Code != http.StatusOK {
		t.Errorf("health check without a session: expected 200, got %d", recorder.Code)
	}
}

func TestClockGate_RoleErrorComesBeforeTheClockRule(t *testing.T) {
	testutil.SetupTestDB(t)
	staff := newGateUser(t, gateStaffEmail, "staff")
	handler := router.New()

	for _, request := range adminOnlyRoutes {
		recorder := sendAs(handler, staff, request)
		body := recorder.Body.String()

		if recorder.Code != http.StatusForbidden || !strings.Contains(body, forbiddenRoleText) {
			t.Errorf("%s: expected 403 about permissions, got %d %q", request.label, recorder.Code, body)
		}
		if strings.Contains(body, auth.ClockInRequiredMessage) {
			t.Errorf("%s: a role error should not mention the clock rule, got %q", request.label, body)
		}
	}
}

func TestClockGate_AdminRoutesWorkForAdminsWhoAreNotClockedIn(t *testing.T) {
	testutil.SetupTestDB(t)
	admin := newGateUser(t, gateAdminEmail, "admin")
	handler := router.New()

	for _, request := range adminOnlyRoutes {
		expectPastTheGate(t, request, sendAs(handler, admin, request))
	}
}

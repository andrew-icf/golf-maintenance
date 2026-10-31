package router_test

import (
	"net/http"
	"testing"
	"time"

	"golf-maintenance/backend/internal/testutil"
)

// Test data. Both moments are in the past, so closing an entry with the current time is
// always later than they are.
const (
	firstClockInText  = "2026-10-01T07:00:00-06:00"
	secondClockInText = "2026-10-02T13:00:00-06:00"
)

func getMe(t *testing.T, handler http.Handler, cookie *http.Cookie) map[string]any {
	t.Helper()
	recorder := sendRequest(handler, http.MethodGet, "/me", "", cookie)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	return decodeJSONObject(t, recorder.Body.Bytes())
}

func expectNotClockedIn(t *testing.T, profile map[string]any) {
	t.Helper()
	if profile["clocked_in"] != false {
		t.Errorf("expected clocked_in to be false, got %v", profile["clocked_in"])
	}
	since, present := profile["clocked_in_since"]
	if !present || since != nil {
		t.Errorf("expected clocked_in_since to be present and null, got %v (present: %v)", since, present)
	}
}

func expectClockedInSince(t *testing.T, profile map[string]any, expectedText string) {
	t.Helper()
	if profile["clocked_in"] != true {
		t.Errorf("expected clocked_in to be true, got %v", profile["clocked_in"])
	}

	text, isText := profile["clocked_in_since"].(string)
	if !isText {
		t.Fatalf("expected clocked_in_since to be a timestamp, got %v", profile["clocked_in_since"])
	}
	actual, err := time.Parse(time.RFC3339Nano, text)
	if err != nil {
		t.Fatalf("clocked_in_since %q is not a timestamp: %v", text, err)
	}
	expected, err := time.Parse(time.RFC3339, expectedText)
	if err != nil {
		t.Fatalf("bad expected time %q: %v", expectedText, err)
	}
	if !actual.Equal(expected) {
		t.Errorf("expected clocked_in_since to be %s, got %s", expected, actual)
	}
}

func TestMe_ReportsNoClockInWhenYouAreNotClockedIn(t *testing.T) {
	staff := setUpStaff(t)

	expectNotClockedIn(t, getMe(t, staff.handler, staff.cookie))
}

func TestMe_ReportsWhenYouClockedIn(t *testing.T) {
	staff := setUpStaff(t)
	clockInAt(t, staff.id, firstClockInText)

	expectClockedInSince(t, getMe(t, staff.handler, staff.cookie), firstClockInText)
}

func TestMe_ReportsNoClockInAfterClockingOut(t *testing.T) {
	staff := setUpStaff(t)
	clockInAt(t, staff.id, firstClockInText)
	testutil.ClockOut(t, staff.id)

	expectNotClockedIn(t, getMe(t, staff.handler, staff.cookie))
}

func TestMe_ReportsTheOpenEntryNotAnEarlierClosedOne(t *testing.T) {
	staff := setUpStaff(t)
	clockInAt(t, staff.id, firstClockInText)
	testutil.ClockOut(t, staff.id)
	clockInAt(t, staff.id, secondClockInText)

	expectClockedInSince(t, getMe(t, staff.handler, staff.cookie), secondClockInText)
}

func TestMe_DoesNotCountAnotherPersonsClockEntry(t *testing.T) {
	staff := setUpStaff(t)
	otherStaff := newPerson(t, "other.staff@example.com", "staff")
	clockInAt(t, otherStaff.id, firstClockInText)

	expectNotClockedIn(t, getMe(t, staff.handler, staff.cookie))
	expectClockedInSince(t, getMe(t, staff.handler, otherStaff.cookie), firstClockInText)
}

func TestMe_ReportsTheClockForAdminsToo(t *testing.T) {
	admin := setUpAdmin(t)
	clockInAt(t, admin.id, firstClockInText)

	expectClockedInSince(t, getMe(t, admin.handler, admin.cookie), firstClockInText)
}

func TestMe_RequiresASession(t *testing.T) {
	staff := setUpStaff(t)

	recorder := sendRequest(staff.handler, http.MethodGet, "/me", "", nil)

	if recorder.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", recorder.Code)
	}
}

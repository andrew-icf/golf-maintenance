package router_test

import (
	"fmt"
	"net/http"
	"testing"
)

// The body for POST /api/schedule
func createShiftBody(userID, shiftDate, startTime, endTime string) string {
	return fmt.Sprintf(
		`{"user_id":%q,"shift_date":%q,"start_time":%q,"end_time":%q}`,
		userID, shiftDate, startTime, endTime,
	)
}

func TestCreateSchedule_CreatesTheShift(t *testing.T) {
	admin := setUpAdmin(t)
	staff := newPerson(t, "luke@example.com", "staff")

	body := createShiftBody(staff.id, "2026-10-07", "06:30", "14:30")
	recorder := sendRequest(admin.handler, http.MethodPost, "/api/schedule", body, admin.cookie)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}

	shiftID, _ := decodeJSONObject(t, recorder.Body.Bytes())["id"].(string)
	if shiftID == "" {
		t.Fatalf("expected the new shift's id in the response, got %s", recorder.Body.String())
	}

	expected := storedShift{UserID: staff.id, ShiftDate: "2026-10-07", StartTime: "06:30:00", EndTime: "14:30:00"}
	if stored := loadShift(t, shiftID); stored != expected {
		t.Errorf("expected the stored shift %+v, got %+v", expected, stored)
	}
	if count := countSchedules(t); count != 1 {
		t.Errorf("expected exactly 1 shift, found %d", count)
	}
}

func TestCreateSchedule_RejectsInvalidRequests(t *testing.T) {
	admin := setUpAdmin(t)
	staff := newPerson(t, "luke@example.com", "staff")

	testCases := []struct {
		name string
		body string
	}{
		{"a body that is not JSON", `{"user_id":`},
		{"no shift date", createShiftBody(staff.id, "", "06:30", "14:30")},
		{"end time equal to start time", createShiftBody(staff.id, "2026-10-07", "06:30", "06:30")},
		{"end time before start time", createShiftBody(staff.id, "2026-10-07", "14:30", "06:30")},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := sendRequest(admin.handler, http.MethodPost, "/api/schedule", testCase.body, admin.cookie)
			if recorder.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d (body: %s)", recorder.Code, recorder.Body.String())
			}
		})
	}

	if count := countSchedules(t); count != 0 {
		t.Errorf("invalid requests must not create rows, found %d", count)
	}
}

// The person may have been removed after the admin's list loaded. That is the admin's
// mistake to fix, so it is a 400 the form can show, not a server error
func TestCreateSchedule_UnknownPersonIsRefused(t *testing.T) {
	admin := setUpAdmin(t)

	for _, userID := range []string{nonexistentID, "not-a-uuid"} {
		t.Run(userID, func(t *testing.T) {
			body := createShiftBody(userID, "2026-10-07", "06:30", "14:30")
			recorder := sendRequest(admin.handler, http.MethodPost, "/api/schedule", body, admin.cookie)
			expectPersonNotFound(t, recorder)
		})
	}

	if count := countSchedules(t); count != 0 {
		t.Errorf("a refused request must not create rows, found %d", count)
	}
}

// Being on the clock doesn't help: creating shifts is for admins only
func TestCreateSchedule_ForbiddenForStaff(t *testing.T) {
	staff := setUpClockedInStaff(t)

	body := createShiftBody(staff.id, "2026-10-07", "06:30", "14:30")
	recorder := sendRequest(staff.handler, http.MethodPost, "/api/schedule", body, staff.cookie)

	if recorder.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	if count := countSchedules(t); count != 0 {
		t.Errorf("a forbidden request must not create rows, found %d", count)
	}
}

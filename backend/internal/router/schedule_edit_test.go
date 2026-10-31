package router_test

import (
	"fmt"
	"net/http"
	"testing"
)

func updateBody(shiftDate, startTime, endTime string) string {
	return fmt.Sprintf(`{"shift_date":%q,"start_time":%q,"end_time":%q}`, shiftDate, startTime, endTime)
}

func TestUpdateSchedule_ChangesOnlyTheTargetedShift(t *testing.T) {
	admin := setUpAdmin(t)
	staff := newPerson(t, "staff@example.com", "staff")

	targetID := insertShift(t, staff.id, "2026-10-05", "07:00", "15:00")
	otherID := insertShift(t, staff.id, "2026-10-06", "07:00", "15:00")
	otherBefore := loadShift(t, otherID)

	recorder := sendRequest(admin.handler, http.MethodPut, "/api/schedule/"+targetID,
		updateBody("2026-10-20", "08:00", "16:00"), admin.cookie)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}

	updated := loadShift(t, targetID)
	expected := storedShift{UserID: staff.id, ShiftDate: "2026-10-20", StartTime: "08:00:00", EndTime: "16:00:00"}
	if updated != expected {
		t.Errorf("expected %+v, got %+v", expected, updated)
	}
	if otherAfter := loadShift(t, otherID); otherAfter != otherBefore {
		t.Errorf("another shift was changed: before %+v, after %+v", otherBefore, otherAfter)
	}
}

func TestUpdateSchedule_RejectsInvalidRequests(t *testing.T) {
	admin := setUpAdmin(t)
	staff := newPerson(t, "staff@example.com", "staff")

	shiftID := insertShift(t, staff.id, "2026-10-05", "07:00", "15:00")
	before := loadShift(t, shiftID)

	testCases := []struct {
		name string
		body string
	}{
		{"end time before start time", updateBody("2026-10-20", "16:00", "08:00")},
		{"end time equal to start time", updateBody("2026-10-20", "08:00", "08:00")},
		{"malformed date", updateBody("10/20/2026", "08:00", "16:00")},
		{"missing date", updateBody("", "08:00", "16:00")},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := sendRequest(admin.handler, http.MethodPut, "/api/schedule/"+shiftID, testCase.body, admin.cookie)
			if recorder.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d (body: %s)", recorder.Code, recorder.Body.String())
			}
		})
	}

	if after := loadShift(t, shiftID); after != before {
		t.Errorf("rejected requests must not change the shift: before %+v, after %+v", before, after)
	}
}

func TestUpdateSchedule_ReturnsNotFoundForUnknownShift(t *testing.T) {
	admin := setUpAdmin(t)

	unknownIDs := []string{
		nonexistentID, // valid UUID, no such shift
		"not-a-uuid",  // not a UUID at all
	}

	for _, unknownID := range unknownIDs {
		recorder := sendRequest(admin.handler, http.MethodPut, "/api/schedule/"+unknownID,
			updateBody("2026-10-20", "08:00", "16:00"), admin.cookie)
		if recorder.Code != http.StatusNotFound {
			t.Errorf("id %q: expected 404, got %d", unknownID, recorder.Code)
		}
	}
}

func TestUpdateSchedule_RequiresAdmin(t *testing.T) {
	staff := setUpStaff(t)

	shiftID := insertShift(t, staff.id, "2026-10-05", "07:00", "15:00")
	before := loadShift(t, shiftID)
	body := updateBody("2026-10-20", "08:00", "16:00")

	noSession := sendRequest(staff.handler, http.MethodPut, "/api/schedule/"+shiftID, body, nil)
	if noSession.Code != http.StatusUnauthorized {
		t.Errorf("no session: expected 401, got %d", noSession.Code)
	}

	asStaff := sendRequest(staff.handler, http.MethodPut, "/api/schedule/"+shiftID, body, staff.cookie)
	if asStaff.Code != http.StatusForbidden {
		t.Errorf("staff: expected 403, got %d", asStaff.Code)
	}

	if after := loadShift(t, shiftID); after != before {
		t.Errorf("blocked requests must not change the shift: before %+v, after %+v", before, after)
	}
}

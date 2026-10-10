package router_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/router"
	"golf-maintenance/backend/internal/testutil"
)

type storedShift struct {
	UserID    string
	ShiftDate string
	StartTime string
	EndTime   string
}

func insertShift(t *testing.T, userID, shiftDate, startTime, endTime string) string {
	t.Helper()
	var shiftID string
	err := db.Pool.QueryRow(
		context.Background(),
		`INSERT INTO schedules (user_id, shift_date, start_time, end_time)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		userID, shiftDate, startTime, endTime,
	).Scan(&shiftID)
	if err != nil {
		t.Fatalf("could not insert shift: %v", err)
	}
	return shiftID
}

func loadShift(t *testing.T, shiftID string) storedShift {
	t.Helper()
	var shift storedShift
	err := db.Pool.QueryRow(
		context.Background(),
		`SELECT user_id::text, shift_date::text, start_time::text, end_time::text
		 FROM schedules WHERE id = $1`,
		shiftID,
	).Scan(&shift.UserID, &shift.ShiftDate, &shift.StartTime, &shift.EndTime)
	if err != nil {
		t.Fatalf("could not load shift %s: %v", shiftID, err)
	}
	return shift
}

func updateBody(shiftDate, startTime, endTime string) string {
	return fmt.Sprintf(`{"shift_date":%q,"start_time":%q,"end_time":%q}`, shiftDate, startTime, endTime)
}

func TestUpdateSchedule_ChangesOnlyTheTargetedShift(t *testing.T) {
	testutil.SetupTestDB(t)
	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	adminCookie := testutil.SessionCookie(t, adminID)
	handler := router.New()

	targetID := insertShift(t, staffID, "2026-10-05", "07:00", "15:00")
	otherID := insertShift(t, staffID, "2026-10-06", "07:00", "15:00")
	otherBefore := loadShift(t, otherID)

	recorder := sendRequest(handler, http.MethodPut, "/api/schedule/"+targetID,
		updateBody("2026-10-20", "08:00", "16:00"), adminCookie)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}

	updated := loadShift(t, targetID)
	expected := storedShift{UserID: staffID, ShiftDate: "2026-10-20", StartTime: "08:00:00", EndTime: "16:00:00"}
	if updated != expected {
		t.Errorf("expected %+v, got %+v", expected, updated)
	}
	if otherAfter := loadShift(t, otherID); otherAfter != otherBefore {
		t.Errorf("another shift was changed: before %+v, after %+v", otherBefore, otherAfter)
	}
}

func TestUpdateSchedule_RejectsInvalidRequests(t *testing.T) {
	testutil.SetupTestDB(t)
	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	adminCookie := testutil.SessionCookie(t, adminID)
	handler := router.New()

	shiftID := insertShift(t, staffID, "2026-10-05", "07:00", "15:00")
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
			recorder := sendRequest(handler, http.MethodPut, "/api/schedule/"+shiftID, testCase.body, adminCookie)
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
	testutil.SetupTestDB(t)
	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	adminCookie := testutil.SessionCookie(t, adminID)
	handler := router.New()

	unknownIDs := []string{
		"00000000-0000-0000-0000-000000000000", // valid UUID, no such shift
		"not-a-uuid",                           // not a UUID at all
	}

	for _, unknownID := range unknownIDs {
		recorder := sendRequest(handler, http.MethodPut, "/api/schedule/"+unknownID,
			updateBody("2026-10-20", "08:00", "16:00"), adminCookie)
		if recorder.Code != http.StatusNotFound {
			t.Errorf("id %q: expected 404, got %d", unknownID, recorder.Code)
		}
	}
}

func TestUpdateSchedule_RequiresAdmin(t *testing.T) {
	testutil.SetupTestDB(t)
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	staffCookie := testutil.SessionCookie(t, staffID)
	handler := router.New()

	shiftID := insertShift(t, staffID, "2026-10-05", "07:00", "15:00")
	before := loadShift(t, shiftID)
	body := updateBody("2026-10-20", "08:00", "16:00")

	noSession := sendRequest(handler, http.MethodPut, "/api/schedule/"+shiftID, body, nil)
	if noSession.Code != http.StatusUnauthorized {
		t.Errorf("no session: expected 401, got %d", noSession.Code)
	}

	asStaff := sendRequest(handler, http.MethodPut, "/api/schedule/"+shiftID, body, staffCookie)
	if asStaff.Code != http.StatusForbidden {
		t.Errorf("staff: expected 403, got %d", asStaff.Code)
	}

	if after := loadShift(t, shiftID); after != before {
		t.Errorf("blocked requests must not change the shift: before %+v, after %+v", before, after)
	}
}

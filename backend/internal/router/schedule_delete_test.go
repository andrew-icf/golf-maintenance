package router_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"golf-maintenance/backend/internal/router"
	"golf-maintenance/backend/internal/testutil"
)

const unknownShiftID = "00000000-0000-0000-0000-000000000000"

func deleteBody(shiftIDs ...string) string {
	encoded, _ := json.Marshal(map[string][]string{"ids": shiftIDs})
	return string(encoded)
}

func TestDeleteSchedules_DeletesOnlyTheSelectedShifts(t *testing.T) {
	testutil.SetupTestDB(t)
	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	adminCookie := testutil.SessionCookie(t, adminID)
	handler := router.New()

	firstID := insertShift(t, staffID, "2026-10-05", "07:00", "15:00")
	secondID := insertShift(t, staffID, "2026-10-06", "07:00", "15:00")
	keptID := insertShift(t, staffID, "2026-10-07", "07:00", "15:00")
	keptBefore := loadShift(t, keptID)

	recorder := sendRequest(handler, http.MethodDelete, "/api/schedule",
		deleteBody(firstID, secondID), adminCookie)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	response := decodeJSONObject(t, recorder.Body.Bytes())
	if response["deleted"] != float64(2) {
		t.Errorf("expected deleted count 2, got %v", response["deleted"])
	}
	if count := countSchedules(t); count != 1 {
		t.Errorf("expected 1 shift left, got %d", count)
	}
	if keptAfter := loadShift(t, keptID); keptAfter != keptBefore {
		t.Errorf("the unselected shift changed: before %+v, after %+v", keptBefore, keptAfter)
	}
}

func TestDeleteSchedules_AListOfOneDeletesASingleShift(t *testing.T) {
	testutil.SetupTestDB(t)
	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	adminCookie := testutil.SessionCookie(t, adminID)
	handler := router.New()

	targetID := insertShift(t, staffID, "2026-10-05", "07:00", "15:00")
	insertShift(t, staffID, "2026-10-06", "07:00", "15:00")

	recorder := sendRequest(handler, http.MethodDelete, "/api/schedule", deleteBody(targetID), adminCookie)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	if count := countSchedules(t); count != 1 {
		t.Errorf("expected 1 shift left, got %d", count)
	}
}

func TestDeleteSchedules_SkipsIdsThatDoNotExistAndDeletesTheRest(t *testing.T) {
	testutil.SetupTestDB(t)
	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	adminCookie := testutil.SessionCookie(t, adminID)
	handler := router.New()

	existingID := insertShift(t, staffID, "2026-10-05", "07:00", "15:00")

	recorder := sendRequest(handler, http.MethodDelete, "/api/schedule",
		deleteBody(existingID, unknownShiftID), adminCookie)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	response := decodeJSONObject(t, recorder.Body.Bytes())
	if response["deleted"] != float64(1) {
		t.Errorf("expected deleted count 1, got %v", response["deleted"])
	}
	if count := countSchedules(t); count != 0 {
		t.Errorf("expected 0 shifts left, got %d", count)
	}
}

func TestDeleteSchedules_ReturnsNotFoundWhenNothingMatches(t *testing.T) {
	testutil.SetupTestDB(t)
	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	adminCookie := testutil.SessionCookie(t, adminID)
	handler := router.New()

	insertShift(t, staffID, "2026-10-05", "07:00", "15:00")

	recorder := sendRequest(handler, http.MethodDelete, "/api/schedule", deleteBody(unknownShiftID), adminCookie)

	if recorder.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", recorder.Code)
	}
	if count := countSchedules(t); count != 1 {
		t.Errorf("an unmatched delete must not remove anything, found %d shifts", count)
	}
}

func TestDeleteSchedules_RejectsInvalidRequests(t *testing.T) {
	testutil.SetupTestDB(t)
	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	adminCookie := testutil.SessionCookie(t, adminID)
	handler := router.New()

	validID := insertShift(t, staffID, "2026-10-05", "07:00", "15:00")

	tooManyIDs := make([]string, 201)
	for index := range tooManyIDs {
		tooManyIDs[index] = fmt.Sprintf("00000000-0000-0000-0000-%012d", index)
	}

	testCases := []struct {
		name string
		body string
	}{
		{"empty list", deleteBody()},
		{"missing ids field", `{}`},
		{"not valid JSON", `not json`},
		{"one malformed id", deleteBody("not-a-uuid")},
		{"malformed id mixed in with a valid one", deleteBody(validID, "not-a-uuid")},
		{"more ids than the batch limit", deleteBody(tooManyIDs...)},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := sendRequest(handler, http.MethodDelete, "/api/schedule", testCase.body, adminCookie)
			if recorder.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d (body: %s)", recorder.Code, recorder.Body.String())
			}
		})
	}

	// The mixed case proves a bad id doesn't leave the request half-processed
	if count := countSchedules(t); count != 1 {
		t.Errorf("rejected requests must not delete anything, found %d shifts", count)
	}
}

func TestDeleteSchedules_RequiresAdmin(t *testing.T) {
	testutil.SetupTestDB(t)
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	staffCookie := testutil.SessionCookie(t, staffID)
	handler := router.New()

	shiftID := insertShift(t, staffID, "2026-10-05", "07:00", "15:00")
	body := deleteBody(shiftID)

	noSession := sendRequest(handler, http.MethodDelete, "/api/schedule", body, nil)
	if noSession.Code != http.StatusUnauthorized {
		t.Errorf("no session: expected 401, got %d", noSession.Code)
	}

	asStaff := sendRequest(handler, http.MethodDelete, "/api/schedule", body, staffCookie)
	if asStaff.Code != http.StatusForbidden {
		t.Errorf("staff: expected 403, got %d", asStaff.Code)
	}

	if count := countSchedules(t); count != 1 {
		t.Errorf("blocked requests must not delete anything, found %d shifts", count)
	}
}

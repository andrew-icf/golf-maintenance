package router_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
)

func deleteBody(shiftIDs ...string) string {
	encoded, _ := json.Marshal(map[string][]string{"ids": shiftIDs})
	return string(encoded)
}

func TestDeleteSchedules_DeletesOnlyTheSelectedShifts(t *testing.T) {
	admin := setUpAdmin(t)
	staff := newPerson(t, "staff@example.com", "staff")

	firstID := insertShift(t, staff.id, "2026-10-05", "07:00", "15:00")
	secondID := insertShift(t, staff.id, "2026-10-06", "07:00", "15:00")
	keptID := insertShift(t, staff.id, "2026-10-07", "07:00", "15:00")
	keptBefore := loadShift(t, keptID)

	recorder := sendRequest(admin.handler, http.MethodDelete, "/api/schedule",
		deleteBody(firstID, secondID), admin.cookie)

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
	admin := setUpAdmin(t)
	staff := newPerson(t, "staff@example.com", "staff")

	targetID := insertShift(t, staff.id, "2026-10-05", "07:00", "15:00")
	insertShift(t, staff.id, "2026-10-06", "07:00", "15:00")

	recorder := sendRequest(admin.handler, http.MethodDelete, "/api/schedule", deleteBody(targetID), admin.cookie)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	if count := countSchedules(t); count != 1 {
		t.Errorf("expected 1 shift left, got %d", count)
	}
}

func TestDeleteSchedules_SkipsIdsThatDoNotExistAndDeletesTheRest(t *testing.T) {
	admin := setUpAdmin(t)
	staff := newPerson(t, "staff@example.com", "staff")

	existingID := insertShift(t, staff.id, "2026-10-05", "07:00", "15:00")

	recorder := sendRequest(admin.handler, http.MethodDelete, "/api/schedule",
		deleteBody(existingID, nonexistentID), admin.cookie)

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
	admin := setUpAdmin(t)
	staff := newPerson(t, "staff@example.com", "staff")

	insertShift(t, staff.id, "2026-10-05", "07:00", "15:00")

	recorder := sendRequest(admin.handler, http.MethodDelete, "/api/schedule", deleteBody(nonexistentID), admin.cookie)

	if recorder.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", recorder.Code)
	}
	if count := countSchedules(t); count != 1 {
		t.Errorf("an unmatched delete must not remove anything, found %d shifts", count)
	}
}

func TestDeleteSchedules_RejectsInvalidRequests(t *testing.T) {
	admin := setUpAdmin(t)
	staff := newPerson(t, "staff@example.com", "staff")

	validID := insertShift(t, staff.id, "2026-10-05", "07:00", "15:00")

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
			recorder := sendRequest(admin.handler, http.MethodDelete, "/api/schedule", testCase.body, admin.cookie)
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
	staff := setUpStaff(t)

	shiftID := insertShift(t, staff.id, "2026-10-05", "07:00", "15:00")
	body := deleteBody(shiftID)

	noSession := sendRequest(staff.handler, http.MethodDelete, "/api/schedule", body, nil)
	if noSession.Code != http.StatusUnauthorized {
		t.Errorf("no session: expected 401, got %d", noSession.Code)
	}

	asStaff := sendRequest(staff.handler, http.MethodDelete, "/api/schedule", body, staff.cookie)
	if asStaff.Code != http.StatusForbidden {
		t.Errorf("staff: expected 403, got %d", asStaff.Code)
	}

	if count := countSchedules(t); count != 1 {
		t.Errorf("blocked requests must not delete anything, found %d shifts", count)
	}
}

package router_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"testing"
)

type repeatResponse struct {
	Created []string `json:"created"`
	Skipped []string `json:"skipped"`
}

func repeatBody(userID, startDate string, weeks int, daysJSON, startTime, endTime string) string {
	return fmt.Sprintf(
		`{"user_id":%q,"start_date":%q,"weeks":%d,"days":%s,"start_time":%q,"end_time":%q}`,
		userID, startDate, weeks, daysJSON, startTime, endTime,
	)
}

func decodeRepeatResponse(t *testing.T, responseBody []byte) repeatResponse {
	t.Helper()
	var response repeatResponse
	if err := json.Unmarshal(responseBody, &response); err != nil {
		t.Fatalf("could not decode response %q: %v", string(responseBody), err)
	}
	return response
}

func TestRepeatSchedule_CreatesShiftsOnSelectedWeekdays(t *testing.T) {
	admin := setUpAdmin(t)
	staff := newPerson(t, "staff@example.com", "staff")

	// 2026-10-05 is a Monday
	body := repeatBody(staff.id, "2026-10-05", 2, `["monday","wednesday","friday"]`, "07:00", "15:00")
	recorder := sendRequest(admin.handler, http.MethodPost, "/api/schedule/repeat", body, admin.cookie)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}

	response := decodeRepeatResponse(t, recorder.Body.Bytes())
	expectedDates := []string{
		"2026-10-05", "2026-10-07", "2026-10-09",
		"2026-10-12", "2026-10-14", "2026-10-16",
	}
	if !reflect.DeepEqual(response.Created, expectedDates) {
		t.Errorf("expected created %v, got %v", expectedDates, response.Created)
	}
	if len(response.Skipped) != 0 {
		t.Errorf("expected nothing skipped, got %v", response.Skipped)
	}
	if count := countSchedules(t); count != 6 {
		t.Errorf("expected 6 rows in the database, got %d", count)
	}
}

func TestRepeatSchedule_StartDateNeedNotMatchSelectedDay(t *testing.T) {
	admin := setUpAdmin(t)
	staff := newPerson(t, "staff@example.com", "staff")

	// Starts on a Wednesday but only Mondays are selected, so the first
	// shift must be the following Monday, not the start date itself.
	body := repeatBody(staff.id, "2026-10-07", 2, `["monday"]`, "07:00", "15:00")
	recorder := sendRequest(admin.handler, http.MethodPost, "/api/schedule/repeat", body, admin.cookie)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}

	response := decodeRepeatResponse(t, recorder.Body.Bytes())
	expectedDates := []string{"2026-10-12", "2026-10-19"}
	if !reflect.DeepEqual(response.Created, expectedDates) {
		t.Errorf("expected created %v, got %v", expectedDates, response.Created)
	}
}

func TestRepeatSchedule_SkipsDatesThatAlreadyHaveAShift(t *testing.T) {
	admin := setUpAdmin(t)
	staff := newPerson(t, "staff@example.com", "staff")
	insertShift(t, staff.id, "2026-10-07", "09:00", "17:00")

	body := repeatBody(staff.id, "2026-10-05", 2, `["monday","wednesday","friday"]`, "07:00", "15:00")
	recorder := sendRequest(admin.handler, http.MethodPost, "/api/schedule/repeat", body, admin.cookie)

	response := decodeRepeatResponse(t, recorder.Body.Bytes())
	if !reflect.DeepEqual(response.Skipped, []string{"2026-10-07"}) {
		t.Errorf("expected only 2026-10-07 skipped, got %v", response.Skipped)
	}
	if len(response.Created) != 5 {
		t.Errorf("expected 5 created, got %v", response.Created)
	}
	// 1 pre-existing + 5 new
	if count := countSchedules(t); count != 6 {
		t.Errorf("expected 6 rows in the database, got %d", count)
	}
}

func TestRepeatSchedule_RunningTwiceCreatesNoDuplicates(t *testing.T) {
	admin := setUpAdmin(t)
	staff := newPerson(t, "staff@example.com", "staff")

	body := repeatBody(staff.id, "2026-10-05", 2, `["monday","wednesday","friday"]`, "07:00", "15:00")
	sendRequest(admin.handler, http.MethodPost, "/api/schedule/repeat", body, admin.cookie)
	secondRun := sendRequest(admin.handler, http.MethodPost, "/api/schedule/repeat", body, admin.cookie)

	response := decodeRepeatResponse(t, secondRun.Body.Bytes())
	if len(response.Created) != 0 {
		t.Errorf("second run should create nothing, got %v", response.Created)
	}
	if len(response.Skipped) != 6 {
		t.Errorf("second run should skip all 6 dates, got %v", response.Skipped)
	}
	if count := countSchedules(t); count != 6 {
		t.Errorf("expected 6 rows total, got %d", count)
	}
}

func TestRepeatSchedule_RejectsInvalidRequests(t *testing.T) {
	admin := setUpAdmin(t)
	staff := newPerson(t, "staff@example.com", "staff")

	testCases := []struct {
		name string
		body string
	}{
		{"end time before start time", repeatBody(staff.id, "2026-10-05", 2, `["monday"]`, "15:00", "07:00")},
		{"end time equal to start time", repeatBody(staff.id, "2026-10-05", 2, `["monday"]`, "07:00", "07:00")},
		{"unknown day name", repeatBody(staff.id, "2026-10-05", 2, `["funday"]`, "07:00", "15:00")},
		{"no days selected", repeatBody(staff.id, "2026-10-05", 2, `[]`, "07:00", "15:00")},
		{"malformed start date", repeatBody(staff.id, "10/05/2026", 2, `["monday"]`, "07:00", "15:00")},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := sendRequest(admin.handler, http.MethodPost, "/api/schedule/repeat", testCase.body, admin.cookie)
			if recorder.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d (body: %s)", recorder.Code, recorder.Body.String())
			}
		})
	}

	if count := countSchedules(t); count != 0 {
		t.Errorf("invalid requests must not create rows, found %d", count)
	}
}

func TestRepeatSchedule_ForbiddenForStaff(t *testing.T) {
	staff := setUpStaff(t)

	body := repeatBody(staff.id, "2026-10-05", 2, `["monday"]`, "07:00", "15:00")
	recorder := sendRequest(staff.handler, http.MethodPost, "/api/schedule/repeat", body, staff.cookie)

	if recorder.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", recorder.Code)
	}
	if count := countSchedules(t); count != 0 {
		t.Errorf("forbidden request must not create rows, found %d", count)
	}
}

func TestRepeatSchedule_UnknownUserCreatesNothing(t *testing.T) {
	admin := setUpAdmin(t)

	body := repeatBody(nonexistentID, "2026-10-05", 2, `["monday"]`, "07:00", "15:00")
	recorder := sendRequest(admin.handler, http.MethodPost, "/api/schedule/repeat", body, admin.cookie)

	if recorder.Code == http.StatusOK {
		t.Errorf("expected a failure status, got 200 (body: %s)", recorder.Body.String())
	}
	if count := countSchedules(t); count != 0 {
		t.Errorf("failed request must not leave rows behind, found %d", count)
	}
}

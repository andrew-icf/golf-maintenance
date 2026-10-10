package router_test

import (
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"testing"

	"golf-maintenance/backend/internal/router"
	"golf-maintenance/backend/internal/testutil"
)

func schedulePath(start, end string) string {
	return fmt.Sprintf("/api/schedule?start=%s&end=%s", start, end)
}

func shiftDates(t *testing.T, responseBody []byte) []string {
	t.Helper()
	dates := []string{}
	for _, shift := range decodeJSONList(t, responseBody) {
		date, _ := shift["shift_date"].(string)
		dates = append(dates, date)
	}
	return dates
}

func TestGetSchedules_RangeIncludesBothEndsAndNothingOutside(t *testing.T) {
	testutil.SetupTestDB(t)
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	cookie := testutil.SessionCookie(t, staffID)
	handler := router.New()

	// Inserted out of order on purpose, with one day of padding on each side
	for _, date := range []string{"2026-10-10", "2026-10-03", "2026-10-07", "2026-10-11", "2026-10-04"} {
		insertShift(t, staffID, date, "07:00", "15:00")
	}

	recorder := sendRequest(handler, http.MethodGet, schedulePath("2026-10-04", "2026-10-10"), "", cookie)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	expectedDates := []string{"2026-10-04", "2026-10-07", "2026-10-10"}
	if dates := shiftDates(t, recorder.Body.Bytes()); !reflect.DeepEqual(dates, expectedDates) {
		t.Errorf("expected %v (both ends included, sorted), got %v", expectedDates, dates)
	}
}

func TestGetSchedules_WithoutARangeReturnsEverything(t *testing.T) {
	testutil.SetupTestDB(t)
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	cookie := testutil.SessionCookie(t, staffID)
	handler := router.New()

	for _, date := range []string{"2026-09-01", "2026-10-07", "2026-12-25"} {
		insertShift(t, staffID, date, "07:00", "15:00")
	}

	recorder := sendRequest(handler, http.MethodGet, "/api/schedule", "", cookie)

	if dates := shiftDates(t, recorder.Body.Bytes()); len(dates) != 3 {
		t.Errorf("expected all 3 shifts, got %v", dates)
	}
}

func TestGetSchedules_StaffSeeEveryonesShifts(t *testing.T) {
	testutil.SetupTestDB(t)
	viewerID := testutil.CreateUser(t, "viewer@example.com", "password123", "staff")
	coworkerID := testutil.CreateUser(t, "coworker@example.com", "password123", "staff")
	viewerCookie := testutil.SessionCookie(t, viewerID)
	handler := router.New()

	insertShift(t, coworkerID, "2026-10-07", "07:00", "15:00")

	recorder := sendRequest(handler, http.MethodGet, schedulePath("2026-10-04", "2026-10-10"), "", viewerCookie)

	shifts := decodeJSONList(t, recorder.Body.Bytes())
	if len(shifts) != 1 {
		t.Fatalf("expected the coworker's shift to be visible, got %d shifts", len(shifts))
	}
	if shifts[0]["user_id"] != coworkerID {
		t.Errorf("expected the shift to belong to %s, got %v", coworkerID, shifts[0]["user_id"])
	}
}

func TestGetSchedules_EmptyRangeIsAnEmptyListNotNull(t *testing.T) {
	testutil.SetupTestDB(t)
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	cookie := testutil.SessionCookie(t, staffID)
	handler := router.New()

	insertShift(t, staffID, "2026-11-01", "07:00", "15:00")

	recorder := sendRequest(handler, http.MethodGet, schedulePath("2026-10-04", "2026-10-10"), "", cookie)

	// The frontend calls .map on this, and null.map would crash it
	if body := strings.TrimSpace(recorder.Body.String()); body != "[]" {
		t.Errorf("expected an empty list, got %q", body)
	}
}

func TestGetSchedules_RejectsInvalidRanges(t *testing.T) {
	testutil.SetupTestDB(t)
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	cookie := testutil.SessionCookie(t, staffID)
	handler := router.New()

	testCases := []struct {
		name string
		path string
	}{
		{"start without end", "/api/schedule?start=2026-10-04"},
		{"end without start", "/api/schedule?end=2026-10-10"},
		{"malformed start", schedulePath("banana", "2026-10-10")},
		{"malformed end", schedulePath("2026-10-04", "banana")},
		{"date without zero padding", schedulePath("2026-10-4", "2026-10-10")},
		{"end before start", schedulePath("2026-10-10", "2026-10-04")},
		{"range of 63 days", schedulePath("2026-01-01", "2026-03-05")},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := sendRequest(handler, http.MethodGet, testCase.path, "", cookie)
			if recorder.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d (body: %s)", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestGetSchedules_AcceptsTheLongestAllowedRange(t *testing.T) {
	testutil.SetupTestDB(t)
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	cookie := testutil.SessionCookie(t, staffID)
	handler := router.New()

	// 2026-01-01 to 2026-03-04 is exactly 62 days apart, the limit
	recorder := sendRequest(handler, http.MethodGet, schedulePath("2026-01-01", "2026-03-04"), "", cookie)

	if recorder.Code != http.StatusOK {
		t.Errorf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
}

func TestGetSchedules_RequiresASession(t *testing.T) {
	testutil.SetupTestDB(t)
	handler := router.New()

	recorder := sendRequest(handler, http.MethodGet, schedulePath("2026-10-04", "2026-10-10"), "", nil)

	if recorder.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", recorder.Code)
	}
}

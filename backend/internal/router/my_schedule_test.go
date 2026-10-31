package router_test

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"sort"
	"strings"
	"testing"

	"golf-maintenance/backend/internal/auth"
	"golf-maintenance/backend/internal/router"
	"golf-maintenance/backend/internal/testutil"
)

// Test data
const (
	myScheduleBasePath  = "/api/my-schedule"
	lukeEmail           = "luke@example.com"
	leiaEmail           = "leia@example.com"
	lukeFullName        = "Luke Skywalker"
	leiaFullName        = "Leia Organa"
	myScheduleAdminName = "Mon Mothma"
)

// Every field a shift carries, the same set the full schedule sends
var shiftResponseKeys = []string{"end_time", "full_name", "id", "shift_date", "start_time", "user_id"}

// Ways someone might try to point the endpoint at another person
var impersonationQueries = []string{"user_id=%s", "userId=%s", "id=%s"}

// Situations a staff member can be in, set up before they ask for their own schedule
var clockSituations = []struct {
	name  string
	setUp func(t *testing.T, userID string)
}{
	{"never clocked in", func(t *testing.T, userID string) {}},
	{"clocked in", func(t *testing.T, userID string) { testutil.ClockIn(t, userID) }},
	{"clocked in and out again", func(t *testing.T, userID string) {
		testutil.ClockIn(t, userID)
		testutil.ClockOut(t, userID)
	}},
}

// Scenarios
type myScheduleUser struct {
	id     string
	cookie *http.Cookie
}

func newMyScheduleUser(t *testing.T, email, role, fullName string) myScheduleUser {
	t.Helper()
	userID := testutil.CreateUser(t, email, "password123", role)
	setFullName(t, userID, fullName)
	return myScheduleUser{id: userID, cookie: testutil.SessionCookie(t, userID)}
}

// Actions
func getMySchedule(handler http.Handler, user myScheduleUser, query string) *httptest.ResponseRecorder {
	path := myScheduleBasePath
	if query != "" {
		path += "?" + query
	}
	return sendRequest(handler, http.MethodGet, path, "", user.cookie)
}

func expectAllShiftsBelongTo(t *testing.T, responseBody []byte, userID string) {
	t.Helper()
	for _, shift := range decodeJSONList(t, responseBody) {
		if shift["user_id"] != userID {
			t.Errorf("expected every shift to belong to %s, got one for %v", userID, shift["user_id"])
		}
	}
}

func expectDates(t *testing.T, responseBody []byte, expected []string) {
	t.Helper()
	if dates := shiftDates(t, responseBody); !reflect.DeepEqual(dates, expected) {
		t.Errorf("expected %v, got %v", expected, dates)
	}
}

func TestMySchedule_RequiresASession(t *testing.T) {
	testutil.SetupTestDB(t)
	handler := router.New()

	recorder := sendRequest(handler, http.MethodGet, myScheduleBasePath, "", nil)

	if recorder.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", recorder.Code)
	}
}

func TestMySchedule_ReturnsOnlyYourOwnShifts(t *testing.T) {
	testutil.SetupTestDB(t)
	luke := newMyScheduleUser(t, lukeEmail, "staff", lukeFullName)
	leia := newMyScheduleUser(t, leiaEmail, "staff", leiaFullName)
	// Inserted out of order, and mixed between the two people, on purpose
	insertShift(t, luke.id, "2026-10-07", "07:00", "15:00")
	insertShift(t, leia.id, "2026-10-06", "06:00", "14:00")
	insertShift(t, luke.id, "2026-10-05", "07:00", "15:00")
	insertShift(t, leia.id, "2026-10-07", "06:00", "14:00")
	handler := router.New()

	lukeBody := getMySchedule(handler, luke, "").Body.Bytes()
	leiaBody := getMySchedule(handler, leia, "").Body.Bytes()

	expectDates(t, lukeBody, []string{"2026-10-05", "2026-10-07"})
	expectDates(t, leiaBody, []string{"2026-10-06", "2026-10-07"})
	expectAllShiftsBelongTo(t, lukeBody, luke.id)
	expectAllShiftsBelongTo(t, leiaBody, leia.id)
}

func TestMySchedule_AdminsSeeOnlyTheirOwnShiftsToo(t *testing.T) {
	testutil.SetupTestDB(t)
	admin := newMyScheduleUser(t, "admin@example.com", "admin", myScheduleAdminName)
	luke := newMyScheduleUser(t, lukeEmail, "staff", lukeFullName)
	insertShift(t, admin.id, "2026-10-05", "08:00", "16:00")
	insertShift(t, luke.id, "2026-10-06", "07:00", "15:00")
	handler := router.New()

	body := getMySchedule(handler, admin, "").Body.Bytes()

	expectDates(t, body, []string{"2026-10-05"})
	expectAllShiftsBelongTo(t, body, admin.id)
}

func TestMySchedule_WorksWhetherOrNotYouAreClockedIn(t *testing.T) {
	for _, situation := range clockSituations {
		t.Run(situation.name, func(t *testing.T) {
			testutil.SetupTestDB(t)
			luke := newMyScheduleUser(t, lukeEmail, "staff", lukeFullName)
			insertShift(t, luke.id, "2026-10-07", "07:00", "15:00")
			situation.setUp(t, luke.id)
			handler := router.New()

			recorder := getMySchedule(handler, luke, "")

			if recorder.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
			}
			expectDates(t, recorder.Body.Bytes(), []string{"2026-10-07"})
		})
	}
}

func TestMySchedule_DoesNotOpenTheFullSchedule(t *testing.T) {
	testutil.SetupTestDB(t)
	luke := newMyScheduleUser(t, lukeEmail, "staff", lukeFullName)
	leia := newMyScheduleUser(t, leiaEmail, "staff", leiaFullName)
	insertShift(t, leia.id, "2026-10-07", "06:00", "14:00")
	handler := router.New()

	recorder := sendRequest(handler, http.MethodGet, "/api/schedule", "", luke.cookie)

	body := strings.TrimSpace(recorder.Body.String())
	if recorder.Code != http.StatusForbidden || body != auth.ClockInRequiredMessage {
		t.Errorf("expected 403 %q, got %d %q", auth.ClockInRequiredMessage, recorder.Code, body)
	}
}

func TestMySchedule_RangeIncludesBothEndsAndNothingOutside(t *testing.T) {
	testutil.SetupTestDB(t)
	luke := newMyScheduleUser(t, lukeEmail, "staff", lukeFullName)
	leia := newMyScheduleUser(t, leiaEmail, "staff", leiaFullName)
	// Luke's shifts are inserted out of order, with one day of padding on each side
	for _, date := range []string{"2026-10-10", "2026-10-03", "2026-10-07", "2026-10-11", "2026-10-04"} {
		insertShift(t, luke.id, date, "07:00", "15:00")
	}
	// Inside the range, but not Luke's
	insertShift(t, leia.id, "2026-10-07", "06:00", "14:00")
	handler := router.New()

	recorder := getMySchedule(handler, luke, "start=2026-10-04&end=2026-10-10")

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	expectDates(t, recorder.Body.Bytes(), []string{"2026-10-04", "2026-10-07", "2026-10-10"})
	expectAllShiftsBelongTo(t, recorder.Body.Bytes(), luke.id)
}

func TestMySchedule_WithoutARangeReturnsAllYourShifts(t *testing.T) {
	testutil.SetupTestDB(t)
	luke := newMyScheduleUser(t, lukeEmail, "staff", lukeFullName)
	leia := newMyScheduleUser(t, leiaEmail, "staff", leiaFullName)
	for _, date := range []string{"2026-12-25", "2026-09-01", "2026-10-07"} {
		insertShift(t, luke.id, date, "07:00", "15:00")
	}
	insertShift(t, leia.id, "2026-10-07", "06:00", "14:00")
	handler := router.New()

	body := getMySchedule(handler, luke, "").Body.Bytes()

	expectDates(t, body, []string{"2026-09-01", "2026-10-07", "2026-12-25"})
}

func TestMySchedule_NoShiftsIsAnEmptyListNotNull(t *testing.T) {
	testutil.SetupTestDB(t)
	luke := newMyScheduleUser(t, lukeEmail, "staff", lukeFullName)
	leia := newMyScheduleUser(t, leiaEmail, "staff", leiaFullName)
	insertShift(t, leia.id, "2026-10-07", "06:00", "14:00")
	handler := router.New()

	recorder := getMySchedule(handler, luke, "start=2026-10-04&end=2026-10-10")

	// The frontend calls .map on this, and null.map would crash it
	if body := strings.TrimSpace(recorder.Body.String()); body != "[]" {
		t.Errorf("expected an empty list, got %q", body)
	}
}

func TestMySchedule_RejectsInvalidRanges(t *testing.T) {
	testutil.SetupTestDB(t)
	luke := newMyScheduleUser(t, lukeEmail, "staff", lukeFullName)
	handler := router.New()

	for _, testCase := range invalidRangeQueries {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := getMySchedule(handler, luke, testCase.query)

			if recorder.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d (body: %s)", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestMySchedule_AcceptsTheLongestAllowedRange(t *testing.T) {
	testutil.SetupTestDB(t)
	luke := newMyScheduleUser(t, lukeEmail, "staff", lukeFullName)
	handler := router.New()

	// 2026-01-01 to 2026-03-04 is exactly 62 days apart, the limit
	recorder := getMySchedule(handler, luke, "start=2026-01-01&end=2026-03-04")

	if recorder.Code != http.StatusOK {
		t.Errorf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
}

func TestMySchedule_CannotBePointedAtAnotherPerson(t *testing.T) {
	testutil.SetupTestDB(t)
	luke := newMyScheduleUser(t, lukeEmail, "staff", lukeFullName)
	leia := newMyScheduleUser(t, leiaEmail, "staff", leiaFullName)
	insertShift(t, luke.id, "2026-10-05", "07:00", "15:00")
	insertShift(t, leia.id, "2026-10-06", "06:00", "14:00")
	handler := router.New()

	for _, queryTemplate := range impersonationQueries {
		query := strings.Replace(queryTemplate, "%s", leia.id, 1)

		body := getMySchedule(handler, luke, query).Body.Bytes()

		expectDates(t, body, []string{"2026-10-05"})
		expectAllShiftsBelongTo(t, body, luke.id)
	}
}

func TestMySchedule_ShiftsCarryTheSameDetailsAsTheFullSchedule(t *testing.T) {
	testutil.SetupTestDB(t)
	luke := newMyScheduleUser(t, lukeEmail, "staff", lukeFullName)
	insertShift(t, luke.id, "2026-10-07", "07:00", "15:30")
	handler := router.New()

	shifts := decodeJSONList(t, getMySchedule(handler, luke, "").Body.Bytes())

	if len(shifts) != 1 {
		t.Fatalf("expected 1 shift, got %d", len(shifts))
	}
	keys := []string{}
	for key := range shifts[0] {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	if !reflect.DeepEqual(keys, shiftResponseKeys) {
		t.Errorf("expected fields %v, got %v", shiftResponseKeys, keys)
	}
	if shifts[0]["full_name"] != lukeFullName {
		t.Errorf("expected the shift to name %q, got %v", lukeFullName, shifts[0]["full_name"])
	}
	if start, _ := shifts[0]["start_time"].(string); !strings.HasPrefix(start, "07:00") {
		t.Errorf("expected a 07:00 start, got %q", start)
	}
	if end, _ := shifts[0]["end_time"].(string); !strings.HasPrefix(end, "15:30") {
		t.Errorf("expected a 15:30 end, got %q", end)
	}
}

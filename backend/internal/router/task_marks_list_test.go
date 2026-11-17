package router_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"testing"
	"time"

	"golf-maintenance/backend/internal/auth"
	"golf-maintenance/backend/internal/router"
	"golf-maintenance/backend/internal/testutil"
)

// What /api/holes/{id}/marks sends back
type markResponse struct {
	FeatureID string    `json:"feature_id"`
	TaskID    string    `json:"task_id"`
	Status    string    `json:"status"`
	UserID    string    `json:"user_id"`
	UserName  string    `json:"user_name"`
	MarkedAt  time.Time `json:"marked_at"`
}

type holeMarksResponse struct {
	Date  string         `json:"date"`
	Marks []markResponse `json:"marks"`
}

// Two time zones a whole day apart, so the day is never the same in both. Kiritimati is 14 hours
// ahead of UTC and Pago Pago is 11 behind.
const (
	farEastTimezone = "Pacific/Kiritimati"
	farWestTimezone = "Pacific/Pago_Pago"
)

// The fields the page reads. They must not change by accident, so they are written out here.
var (
	expectedHoleMarksFields = []string{"date", "marks"}
	expectedMarkFields      = []string{"feature_id", "marked_at", "status", "task_id", "user_id", "user_name"}
)

// Ids that are not written like an id, which must be a bad request and never a server error
var malformedHoleIDCases = []struct {
	name string
	id   string
}{
	{"a word", "banana"},
	{"a number", "12345678"},
	{"an id one character short", "12345678-1234-1234-1234-12345678901"},
	{"an id one character long", "12345678-1234-1234-1234-1234567890123"},
	{"an id with letters that are not hexadecimal", "gggggggg-gggg-gggg-gggg-gggggggggggg"},
}

// Used to give each reader of the marks their own account within one test
var markReaderCount int

// Actions
// The club's date, a number of days from today. It asks the database in the course's own timezone,
// the same way the server does, so the tests do not depend on when they are run.
func clubDate(t *testing.T, dayOffset int) string {
	t.Helper()
	return lookupText(t,
		`SELECT ((now() AT TIME ZONE timezone)::date + $1::int)::text FROM courses LIMIT 1`,
		dayOffset,
	)
}

// An admin who is never held at the clock-in rule, so the data is all that is being tested
func readMarksCookie(t *testing.T) *http.Cookie {
	t.Helper()
	markReaderCount++
	return newPerson(t, fmt.Sprintf("mark.reader.%d@example.com", markReaderCount), "admin").cookie
}

func holeMarksBody(t *testing.T, holeID string) []byte {
	t.Helper()
	recorder := sendRequest(router.New(), http.MethodGet, "/api/holes/"+holeID+"/marks", "", readMarksCookie(t))
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	return recorder.Body.Bytes()
}

func fetchHoleMarks(t *testing.T, holeID string) holeMarksResponse {
	t.Helper()
	body := holeMarksBody(t, holeID)

	var response holeMarksResponse
	if err := json.Unmarshal(body, &response); err != nil {
		t.Fatalf("could not decode response %q: %v", string(body), err)
	}
	return response
}

func setMarkedAt(t *testing.T, featureID, taskID string, markedAt time.Time) {
	t.Helper()
	mustExec(t,
		`UPDATE task_marks SET marked_at = $1 WHERE hole_feature_id = $2 AND task_id = $3`,
		markedAt, featureID, taskID,
	)
}

func statusByTask(marks []markResponse) map[string]string {
	statuses := map[string]string{}
	for _, mark := range marks {
		statuses[mark.TaskID] = mark.Status
	}
	return statuses
}

func TestGetHoleMarks_Access(t *testing.T) {
	testutil.SetupTestDB(t)
	holeID := buildClub(t, []int{1}).HoleIDs[0][0]
	handler := router.New()
	offTheClock := newPerson(t, "off.the.clock@example.com", "staff")
	onTheClock := newPerson(t, "on.the.clock@example.com", "staff")
	testutil.ClockIn(t, onTheClock.id)
	admin := newPerson(t, "admin@example.com", "admin")

	testCases := []struct {
		name           string
		cookie         *http.Cookie
		expectedStatus int
	}{
		{"no session", nil, http.StatusUnauthorized},
		{"staff who are not clocked in", offTheClock.cookie, http.StatusForbidden},
		{"staff who are clocked in", onTheClock.cookie, http.StatusOK},
		{"an admin who is not clocked in", admin.cookie, http.StatusOK},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := sendRequest(handler, http.MethodGet, "/api/holes/"+holeID+"/marks", "", testCase.cookie)

			if recorder.Code != testCase.expectedStatus {
				t.Fatalf("expected %d, got %d", testCase.expectedStatus, recorder.Code)
			}
			if testCase.expectedStatus == http.StatusForbidden {
				if message := strings.TrimSpace(recorder.Body.String()); message != auth.ClockInRequiredMessage {
					t.Errorf("expected the message %q, got %q", auth.ClockInRequiredMessage, message)
				}
			}
		})
	}
}

func TestGetHoleMarks_SendsTheClubsDateAndTodaysMarks(t *testing.T) {
	scenario := setUpMarkScenario(t)
	today := clubDate(t, 0)
	mustAddTaskMark(t, today, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)

	response := fetchHoleMarks(t, scenario.holeOneID)

	if response.Date != today {
		t.Errorf("expected the club's date %q, got %q", today, response.Date)
	}
	if len(response.Marks) != 1 {
		t.Fatalf("expected 1 mark, got %d", len(response.Marks))
	}
	mark := response.Marks[0]
	if mark.FeatureID != scenario.holeOneTeeBoxID || mark.TaskID != scenario.teeBoxMowedTaskID {
		t.Errorf("the mark is on the wrong task or feature: %+v", mark)
	}
	if mark.Status != "done" || mark.UserID != scenario.userID {
		t.Errorf("expected a mark done by %s, got %+v", scenario.userID, mark)
	}
	if age := time.Since(mark.MarkedAt); age < 0 || age > time.Minute {
		t.Errorf("expected the time the mark was made, got %v", mark.MarkedAt)
	}
}

func TestGetHoleMarks_NamesWhoMadeEachMark(t *testing.T) {
	scenario := setUpMarkScenario(t)
	mustExec(t, `UPDATE users SET full_name = $1 WHERE id = $2`, "Yoda", scenario.userID)
	mustExec(t, `UPDATE users SET full_name = $1 WHERE id = $2`, "Luke Skywalker", scenario.otherUserID)
	today := clubDate(t, 0)
	mustAddTaskMark(t, today, scenario.holeOneTeeBoxID, scenario.teeBoxClearedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, today, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.otherUserID)

	response := fetchHoleMarks(t, scenario.holeOneID)

	names := map[string][]string{}
	for _, mark := range response.Marks {
		names[mark.TaskID] = []string{mark.UserID, mark.UserName}
	}
	expected := map[string][]string{
		scenario.teeBoxClearedTaskID: {scenario.userID, "Yoda"},
		scenario.teeBoxMowedTaskID:   {scenario.otherUserID, "Luke Skywalker"},
	}
	if !reflect.DeepEqual(names, expected) {
		t.Errorf("expected %v, got %v", expected, names)
	}
}

func TestGetHoleMarks_OnlyTheHolesOwnMarks(t *testing.T) {
	scenario := setUpMarkScenario(t)
	today := clubDate(t, 0)
	mustAddTaskMark(t, today, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, today, scenario.holeTwoTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, today, scenario.holeTwoTeeBoxID, scenario.teeBoxClearedTaskID, "not_today", scenario.userID)

	holeOne := fetchHoleMarks(t, scenario.holeOneID)
	holeTwo := fetchHoleMarks(t, scenario.holeTwoID)

	if len(holeOne.Marks) != 1 || holeOne.Marks[0].FeatureID != scenario.holeOneTeeBoxID {
		t.Errorf("hole one should have only its own mark, got %+v", holeOne.Marks)
	}
	if len(holeTwo.Marks) != 2 {
		t.Fatalf("hole two should have its 2 marks, got %d", len(holeTwo.Marks))
	}
	for _, mark := range holeTwo.Marks {
		if mark.FeatureID != scenario.holeTwoTeeBoxID {
			t.Errorf("hole two has a mark from another hole: %+v", mark)
		}
	}
}

func TestGetHoleMarks_OnlyTodaysMarks(t *testing.T) {
	scenario := setUpMarkScenario(t)
	mustAddTaskMark(t, clubDate(t, -1), scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.otherUserID)
	mustAddTaskMark(t, clubDate(t, 0), scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, clubDate(t, 1), scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.otherUserID)

	response := fetchHoleMarks(t, scenario.holeOneID)

	if len(response.Marks) != 1 || response.Marks[0].UserID != scenario.userID {
		t.Errorf("expected only today's mark, made by %s, got %+v", scenario.userID, response.Marks)
	}
}

func TestGetHoleMarks_FollowsTheClubsOwnTimezone(t *testing.T) {
	scenario := setUpMarkScenario(t)
	mustExec(t, `UPDATE courses SET timezone = $1`, farEastTimezone)
	clubToday := clubDate(t, 0)
	otherZoneToday := lookupText(t, `SELECT (now() AT TIME ZONE $1::text)::date::text`, farWestTimezone)
	if clubToday == otherZoneToday {
		t.Fatalf("expected the two zones to be on different days, both are on %s", clubToday)
	}
	mustAddTaskMark(t, clubToday, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, otherZoneToday, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.otherUserID)

	response := fetchHoleMarks(t, scenario.holeOneID)

	if response.Date != clubToday {
		t.Errorf("expected the club's date %q, got %q", clubToday, response.Date)
	}
	if len(response.Marks) != 1 || response.Marks[0].UserID != scenario.userID {
		t.Errorf("expected only the mark from the club's own day, got %+v", response.Marks)
	}
}

func TestGetHoleMarks_ReportsBothStatuses(t *testing.T) {
	scenario := setUpMarkScenario(t)
	today := clubDate(t, 0)
	mustAddTaskMark(t, today, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, today, scenario.holeOneTeeBoxID, scenario.teeBoxClearedTaskID, "not_today", scenario.userID)

	response := fetchHoleMarks(t, scenario.holeOneID)

	expected := map[string]string{
		scenario.teeBoxMowedTaskID:   "done",
		scenario.teeBoxClearedTaskID: "not_today",
	}
	if actual := statusByTask(response.Marks); !reflect.DeepEqual(actual, expected) {
		t.Errorf("expected %v, got %v", expected, actual)
	}
}

func TestGetHoleMarks_TellsTheBunkersApart(t *testing.T) {
	scenario := setUpMarkScenario(t)
	today := clubDate(t, 0)
	mustAddTaskMark(t, today, scenario.holeOneBunkerOneID, scenario.bunkerRakedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, today, scenario.holeOneBunkerTwoID, scenario.bunkerRakedTaskID, "not_today", scenario.userID)

	response := fetchHoleMarks(t, scenario.holeOneID)

	statusByBunker := map[string]string{}
	for _, mark := range response.Marks {
		statusByBunker[mark.FeatureID] = mark.Status
	}
	expected := map[string]string{
		scenario.holeOneBunkerOneID: "done",
		scenario.holeOneBunkerTwoID: "not_today",
	}
	if !reflect.DeepEqual(statusByBunker, expected) {
		t.Errorf("expected %v, got %v", expected, statusByBunker)
	}
}

func TestGetHoleMarks_NoMarksIsAListNotNull(t *testing.T) {
	scenario := setUpMarkScenario(t)

	response := fetchHoleMarks(t, scenario.holeOneID)

	if response.Date != clubDate(t, 0) {
		t.Errorf("expected the club's date %q, got %q", clubDate(t, 0), response.Date)
	}
	if response.Marks == nil || len(response.Marks) != 0 {
		t.Errorf("expected an empty list of marks, got %v", response.Marks)
	}
}

func TestGetHoleMarks_AHoleThatDoesNotExistIsNotFound(t *testing.T) {
	testutil.SetupTestDB(t)
	buildClub(t, []int{1})

	recorder := sendRequest(router.New(), http.MethodGet, "/api/holes/"+nonexistentID+"/marks", "", readMarksCookie(t))

	if recorder.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", recorder.Code)
	}
}

func TestGetHoleMarks_AnIdThatIsNotAnIdIsABadRequestNotAServerError(t *testing.T) {
	testutil.SetupTestDB(t)
	buildClub(t, []int{1})
	cookie := readMarksCookie(t)

	for _, testCase := range malformedHoleIDCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := sendRequest(router.New(), http.MethodGet, "/api/holes/"+testCase.id+"/marks", "", cookie)

			if recorder.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d", recorder.Code)
			}
		})
	}
}

func TestGetHoleMarks_AnIdInCapitalsIsTheSameHole(t *testing.T) {
	scenario := setUpMarkScenario(t)
	mustAddTaskMark(t, clubDate(t, 0), scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)

	response := fetchHoleMarks(t, strings.ToUpper(scenario.holeOneID))

	if len(response.Marks) != 1 {
		t.Errorf("expected the hole's 1 mark, got %d", len(response.Marks))
	}
}

func TestGetHoleMarks_SendsExactlyTheFieldsThePageReads(t *testing.T) {
	scenario := setUpMarkScenario(t)
	mustAddTaskMark(t, clubDate(t, 0), scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)

	var raw struct {
		Marks []map[string]any `json:"marks"`
	}
	var top map[string]any
	body := holeMarksBody(t, scenario.holeOneID)
	if err := json.Unmarshal(body, &top); err != nil {
		t.Fatalf("could not decode response %q: %v", string(body), err)
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		t.Fatalf("could not decode response %q: %v", string(body), err)
	}

	if actual := sortedKeysOf(top); !reflect.DeepEqual(actual, expectedHoleMarksFields) {
		t.Errorf("the response has the fields %v, expected %v", actual, expectedHoleMarksFields)
	}
	if len(raw.Marks) != 1 {
		t.Fatalf("expected 1 mark, got %d", len(raw.Marks))
	}
	if actual := sortedKeysOf(raw.Marks[0]); !reflect.DeepEqual(actual, expectedMarkFields) {
		t.Errorf("a mark has the fields %v, expected %v", actual, expectedMarkFields)
	}
}

func TestGetHoleMarks_MarksComeBackInTheOrderTheyWereMade(t *testing.T) {
	scenario := setUpMarkScenario(t)
	today := clubDate(t, 0)
	garbageTaskID := taskIDOf(t, "collect-garbage")
	mustAddTaskMark(t, today, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, today, scenario.holeOneTeeBoxID, scenario.teeBoxClearedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, today, scenario.holeOneTeeBoxID, garbageTaskID, "done", scenario.userID)
	// The times are set out of order on purpose, so the order can only come from the times
	base := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	setMarkedAt(t, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, base.Add(2*time.Minute))
	setMarkedAt(t, scenario.holeOneTeeBoxID, scenario.teeBoxClearedTaskID, base)
	setMarkedAt(t, scenario.holeOneTeeBoxID, garbageTaskID, base.Add(time.Minute))

	response := fetchHoleMarks(t, scenario.holeOneID)

	actual := []string{}
	for _, mark := range response.Marks {
		actual = append(actual, mark.TaskID)
	}
	expected := []string{scenario.teeBoxClearedTaskID, garbageTaskID, scenario.teeBoxMowedTaskID}
	if !reflect.DeepEqual(actual, expected) {
		t.Errorf("expected the marks in the order they were made, %v, got %v", expected, actual)
	}
}

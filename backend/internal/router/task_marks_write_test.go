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

// What a person is told when someone has already marked the task the other way
const conflictText = "already marked"

// Every job title and whether it is an admin one, written out by hand so the permission rule is
// checked against this list and not against the code's own
var crewTitles = []struct {
	title   string
	isAdmin bool
}{
	{"superintendent", true},
	{"assistant_superintendent", true},
	{"master_mechanic", true},
	{"operator", false},
	{"greenskeeper", false},
	{"landscaper", false},
	{"mechanic", false},
	{"office_admin", false},
}

// A greenskeeper task and an operator task, which is enough for the checks that do not need all 17
var representativeTaskCodes = []string{"tee-box-cleared", "tee-box-mowed"}

// A mark and a second person's answer to it
var conflictCases = []struct {
	name   string
	first  string
	second string
}{
	{"checked, then set aside", "done", "not_today"},
	{"set aside, then checked", "not_today", "done"},
}

var bothStatuses = []string{"done", "not_today"}

type crewMember struct {
	id     string
	cookie *http.Cookie
}

// Actions
// A person with the given job title. Staff are put on the clock unless told otherwise, and admins
// never need to be.
func newCrewMember(t *testing.T, email, jobTitle string, onTheClock bool) crewMember {
	t.Helper()
	role := "staff"
	for _, entry := range crewTitles {
		if entry.title == jobTitle && entry.isAdmin {
			role = "admin"
		}
	}

	person := newPerson(t, email, role)
	mustExec(t, `UPDATE users SET job_title = $1 WHERE id = $2`, jobTitle, person.id)
	if onTheClock {
		testutil.ClockIn(t, person.id)
	}
	return crewMember{id: person.id, cookie: person.cookie}
}

// One person for every job title, the staff on the clock and the admins not
func setUpCrew(t *testing.T) map[string]crewMember {
	t.Helper()
	crew := map[string]crewMember{}
	for _, entry := range crewTitles {
		email := "crew." + strings.ReplaceAll(entry.title, "_", ".") + "@example.com"
		crew[entry.title] = newCrewMember(t, email, entry.title, !entry.isAdmin)
	}
	return crew
}

func nameCrewMember(t *testing.T, member crewMember, fullName string) {
	t.Helper()
	mustExec(t, `UPDATE users SET full_name = $1 WHERE id = $2`, fullName, member.id)
}

func defaultTask(t *testing.T, code string) storedTask {
	t.Helper()
	for _, task := range expectedDefaultTasks {
		if task.Code == code {
			return task
		}
	}
	t.Fatalf("there is no default task with the code %s", code)
	return storedTask{}
}

// The first feature of hole one that the task is for, and the task itself
func featureAndTask(t *testing.T, scenario markScenario, code string) (string, string) {
	t.Helper()
	task := defaultTask(t, code)
	return featureIDOf(t, scenario.holeOneID, task.FeatureType, 1), taskIDOf(t, code)
}

func statusBody(status string) string {
	return fmt.Sprintf(`{"status":%q}`, status)
}

func sendMarkRequest(method string, cookie *http.Cookie, featureID, taskID, body string) (int, string) {
	recorder := sendRequest(router.New(), method, "/api/marks/"+featureID+"/"+taskID, body, cookie)
	return recorder.Code, recorder.Body.String()
}

func decodeMark(t *testing.T, body string) markResponse {
	t.Helper()
	var mark markResponse
	if err := json.Unmarshal([]byte(body), &mark); err != nil {
		t.Fatalf("could not decode response %q: %v", body, err)
	}
	return mark
}

// Checks every job title against each of the tasks. A mark is only made when the title is an admin
// one or is the title the task names, and a refused request must leave nothing behind and must not
// tell the person to clock in.
func runCheckMatrix(t *testing.T, status string, taskCodes []string) {
	t.Helper()
	scenario := setUpMarkScenario(t)
	crew := setUpCrew(t)

	for _, code := range taskCodes {
		task := defaultTask(t, code)
		featureID, taskID := featureAndTask(t, scenario, code)
		for _, entry := range crewTitles {
			t.Run(entry.title+" on "+code, func(t *testing.T) {
				mustExec(t, `DELETE FROM task_marks`)
				member := crew[entry.title]

				statusCode, body := sendMarkRequest(http.MethodPut, member.cookie, featureID, taskID, statusBody(status))

				marks := loadTaskMarks(t)
				if entry.isAdmin || entry.title == task.JobTitles {
					if statusCode != http.StatusOK {
						t.Fatalf("expected 200, got %d (body: %s)", statusCode, body)
					}
					expected := []storedMark{{clubDate(t, 0), featureID, taskID, status, member.id}}
					if !reflect.DeepEqual(marks, expected) {
						t.Errorf("expected %+v, got %+v", expected, marks)
					}
					return
				}

				if statusCode != http.StatusForbidden {
					t.Fatalf("expected 403, got %d (body: %s)", statusCode, body)
				}
				if strings.TrimSpace(body) == auth.ClockInRequiredMessage {
					t.Errorf("a person who may not check a task must not be told to clock in")
				}
				if len(marks) != 0 {
					t.Errorf("a refused request must not make a mark, found %d", len(marks))
				}
			})
		}
	}
}

func TestSetTaskMark_EveryJobTitleAgainstEveryTask(t *testing.T) {
	codes := []string{}
	for _, task := range expectedDefaultTasks {
		codes = append(codes, task.Code)
	}

	runCheckMatrix(t, "done", codes)
}

func TestSetTaskMark_SettingATaskAsideFollowsTheSameRule(t *testing.T) {
	runCheckMatrix(t, "not_today", representativeTaskCodes)
}

func TestSetTaskMark_Access(t *testing.T) {
	scenario := setUpMarkScenario(t)
	featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")
	offTheClock := newCrewMember(t, "operator.off@example.com", "operator", false)
	onTheClock := newCrewMember(t, "operator.on@example.com", "operator", true)
	admin := newCrewMember(t, "admin.off@example.com", "superintendent", false)

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
			statusCode, body := sendMarkRequest(http.MethodPut, testCase.cookie, featureID, taskID, statusBody("done"))

			if statusCode != testCase.expectedStatus {
				t.Fatalf("expected %d, got %d", testCase.expectedStatus, statusCode)
			}
			if testCase.expectedStatus == http.StatusForbidden {
				if message := strings.TrimSpace(body); message != auth.ClockInRequiredMessage {
					t.Errorf("expected the message %q, got %q", auth.ClockInRequiredMessage, message)
				}
			}
		})
	}
}

func TestSetTaskMark_RecordsTodayWithWhoAndWhen(t *testing.T) {
	scenario := setUpMarkScenario(t)
	operator := newCrewMember(t, "luke.operator@example.com", "operator", true)
	nameCrewMember(t, operator, "Luke Skywalker")
	featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")

	statusCode, body := sendMarkRequest(http.MethodPut, operator.cookie, featureID, taskID, statusBody("done"))

	if statusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", statusCode, body)
	}
	mark := decodeMark(t, body)
	if mark.FeatureID != featureID || mark.TaskID != taskID || mark.Status != "done" {
		t.Errorf("the mark is on the wrong task, feature, or status: %+v", mark)
	}
	if mark.UserID != operator.id || mark.UserName != "Luke Skywalker" {
		t.Errorf("expected the mark to name Luke Skywalker, got %+v", mark)
	}
	if age := time.Since(mark.MarkedAt); age < 0 || age > time.Minute {
		t.Errorf("expected the time the mark was made, got %v", mark.MarkedAt)
	}
	expected := []storedMark{{clubDate(t, 0), featureID, taskID, "done", operator.id}}
	if actual := loadTaskMarks(t); !reflect.DeepEqual(actual, expected) {
		t.Errorf("expected %+v, got %+v", expected, actual)
	}
}

func TestSetTaskMark_BothStatusesAreSaved(t *testing.T) {
	for _, status := range bothStatuses {
		t.Run(status, func(t *testing.T) {
			scenario := setUpMarkScenario(t)
			operator := newCrewMember(t, "luke.operator@example.com", "operator", true)
			featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")

			statusCode, body := sendMarkRequest(http.MethodPut, operator.cookie, featureID, taskID, statusBody(status))

			if statusCode != http.StatusOK {
				t.Fatalf("expected 200, got %d (body: %s)", statusCode, body)
			}
			marks := loadTaskMarks(t)
			if len(marks) != 1 || marks[0].Status != status {
				t.Errorf("expected one mark with the status %q, got %+v", status, marks)
			}
		})
	}
}

func TestSetTaskMark_FollowsTheClubsOwnTimezone(t *testing.T) {
	for _, timezone := range []string{farEastTimezone, farWestTimezone} {
		t.Run(timezone, func(t *testing.T) {
			scenario := setUpMarkScenario(t)
			operator := newCrewMember(t, "luke.operator@example.com", "operator", true)
			featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")
			mustExec(t, `UPDATE courses SET timezone = $1`, timezone)
			expectedDate := lookupText(t, `SELECT (now() AT TIME ZONE $1::text)::date::text`, timezone)

			statusCode, body := sendMarkRequest(http.MethodPut, operator.cookie, featureID, taskID, statusBody("done"))

			if statusCode != http.StatusOK {
				t.Fatalf("expected 200, got %d (body: %s)", statusCode, body)
			}
			marks := loadTaskMarks(t)
			if len(marks) != 1 || marks[0].Date != expectedDate {
				t.Errorf("expected one mark on the club's day %s, got %+v", expectedDate, marks)
			}
		})
	}
}

func TestSetTaskMark_ASecondTapOfTheSameStatusKeepsTheFirstPerson(t *testing.T) {
	scenario := setUpMarkScenario(t)
	first := newCrewMember(t, "first.operator@example.com", "operator", true)
	second := newCrewMember(t, "second.operator@example.com", "operator", true)
	nameCrewMember(t, first, "Luke Skywalker")
	nameCrewMember(t, second, "Han Solo")
	featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")
	if statusCode, body := sendMarkRequest(http.MethodPut, first.cookie, featureID, taskID, statusBody("done")); statusCode != http.StatusOK {
		t.Fatalf("expected 200 for the first tap, got %d (body: %s)", statusCode, body)
	}
	firstMarkedAt := lookupText(t, `SELECT marked_at::text FROM task_marks`)

	statusCode, body := sendMarkRequest(http.MethodPut, second.cookie, featureID, taskID, statusBody("done"))

	if statusCode != http.StatusOK {
		t.Fatalf("expected 200 for the second tap, got %d (body: %s)", statusCode, body)
	}
	mark := decodeMark(t, body)
	if mark.UserID != first.id || mark.UserName != "Luke Skywalker" {
		t.Errorf("the mark should still name the first person, got %+v", mark)
	}
	marks := loadTaskMarks(t)
	if len(marks) != 1 || marks[0].UserID != first.id {
		t.Errorf("expected one mark, still the first person's, got %+v", marks)
	}
	if markedAt := lookupText(t, `SELECT marked_at::text FROM task_marks`); markedAt != firstMarkedAt {
		t.Errorf("the second tap must not change when the mark was made: %s became %s", firstMarkedAt, markedAt)
	}
}

func TestSetTaskMark_TheOtherStatusIsAConflictUntilItIsUndone(t *testing.T) {
	for _, testCase := range conflictCases {
		t.Run(testCase.name, func(t *testing.T) {
			scenario := setUpMarkScenario(t)
			first := newCrewMember(t, "first.operator@example.com", "operator", true)
			second := newCrewMember(t, "second.operator@example.com", "operator", true)
			featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")
			if statusCode, body := sendMarkRequest(http.MethodPut, first.cookie, featureID, taskID, statusBody(testCase.first)); statusCode != http.StatusOK {
				t.Fatalf("expected 200 for the first tap, got %d (body: %s)", statusCode, body)
			}

			statusCode, body := sendMarkRequest(http.MethodPut, second.cookie, featureID, taskID, statusBody(testCase.second))

			if statusCode != http.StatusConflict {
				t.Fatalf("expected 409, got %d (body: %s)", statusCode, body)
			}
			if !strings.Contains(body, conflictText) {
				t.Errorf("expected the message to say %q, got %q", conflictText, body)
			}
			marks := loadTaskMarks(t)
			if len(marks) != 1 || marks[0].Status != testCase.first || marks[0].UserID != first.id {
				t.Errorf("the first person's mark must stay as it was, got %+v", marks)
			}
		})
	}
}

func TestSetTaskMark_AMarkCanBeUndoneAndThenMarkedTheOtherWay(t *testing.T) {
	scenario := setUpMarkScenario(t)
	first := newCrewMember(t, "first.operator@example.com", "operator", true)
	second := newCrewMember(t, "second.operator@example.com", "operator", true)
	featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")
	if statusCode, body := sendMarkRequest(http.MethodPut, first.cookie, featureID, taskID, statusBody("done")); statusCode != http.StatusOK {
		t.Fatalf("expected 200 to mark it, got %d (body: %s)", statusCode, body)
	}
	if statusCode, body := sendMarkRequest(http.MethodDelete, second.cookie, featureID, taskID, ""); statusCode != http.StatusNoContent {
		t.Fatalf("expected 204 to undo it, got %d (body: %s)", statusCode, body)
	}

	statusCode, body := sendMarkRequest(http.MethodPut, second.cookie, featureID, taskID, statusBody("not_today"))

	if statusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", statusCode, body)
	}
	expected := []storedMark{{clubDate(t, 0), featureID, taskID, "not_today", second.id}}
	if actual := loadTaskMarks(t); !reflect.DeepEqual(actual, expected) {
		t.Errorf("expected %+v, got %+v", expected, actual)
	}
}

func TestSetTaskMark_YesterdaysMarkDoesNotBlockToday(t *testing.T) {
	scenario := setUpMarkScenario(t)
	operator := newCrewMember(t, "luke.operator@example.com", "operator", true)
	featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")
	yesterday := clubDate(t, -1)
	mustAddTaskMark(t, yesterday, featureID, taskID, "done", scenario.otherUserID)

	statusCode, body := sendMarkRequest(http.MethodPut, operator.cookie, featureID, taskID, statusBody("not_today"))

	if statusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", statusCode, body)
	}
	expected := []storedMark{
		{yesterday, featureID, taskID, "done", scenario.otherUserID},
		{clubDate(t, 0), featureID, taskID, "not_today", operator.id},
	}
	if actual := loadTaskMarks(t); !reflect.DeepEqual(actual, expected) {
		t.Errorf("expected %+v, got %+v", expected, actual)
	}
}

func TestSetTaskMark_Errors(t *testing.T) {
	scenario := setUpMarkScenario(t)
	admin := newCrewMember(t, "admin@example.com", "superintendent", false)
	featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")
	greenTaskID := taskIDOf(t, "green-mowed")

	testCases := []struct {
		name           string
		featureID      string
		taskID         string
		body           string
		expectedStatus int
	}{
		{"a feature that does not exist", nonexistentID, taskID, statusBody("done"), http.StatusNotFound},
		{"a task that does not exist", featureID, nonexistentID, statusBody("done"), http.StatusNotFound},
		{"a task for a different kind of feature", featureID, greenTaskID, statusBody("done"), http.StatusBadRequest},
		{"a feature id that is not an id", "banana", taskID, statusBody("done"), http.StatusBadRequest},
		{"a task id that is not an id", featureID, "banana", statusBody("done"), http.StatusBadRequest},
		{"no body", featureID, taskID, "", http.StatusBadRequest},
		{"a body that is not JSON", featureID, taskID, "done", http.StatusBadRequest},
		{"a word that is not a status", featureID, taskID, statusBody("finished"), http.StatusBadRequest},
		{"a status in capitals", featureID, taskID, statusBody("DONE"), http.StatusBadRequest},
		{"an empty status", featureID, taskID, statusBody(""), http.StatusBadRequest},
		{"no status at all", featureID, taskID, `{}`, http.StatusBadRequest},
		{"a status that is a number", featureID, taskID, `{"status":5}`, http.StatusBadRequest},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			statusCode, body := sendMarkRequest(http.MethodPut, admin.cookie, testCase.featureID, testCase.taskID, testCase.body)

			if statusCode != testCase.expectedStatus {
				t.Errorf("expected %d, got %d (body: %s)", testCase.expectedStatus, statusCode, body)
			}
			if count := len(loadTaskMarks(t)); count != 0 {
				t.Errorf("a refused request must not make a mark, found %d", count)
			}
		})
	}
}

func TestSetTaskMark_SendsExactlyTheFieldsThePageReads(t *testing.T) {
	scenario := setUpMarkScenario(t)
	operator := newCrewMember(t, "luke.operator@example.com", "operator", true)
	featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")

	statusCode, body := sendMarkRequest(http.MethodPut, operator.cookie, featureID, taskID, statusBody("done"))

	if statusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", statusCode, body)
	}
	var fields map[string]any
	if err := json.Unmarshal([]byte(body), &fields); err != nil {
		t.Fatalf("could not decode response %q: %v", body, err)
	}
	if actual := sortedKeysOf(fields); !reflect.DeepEqual(actual, expectedMarkFields) {
		t.Errorf("the mark has the fields %v, expected %v", actual, expectedMarkFields)
	}
}

func TestClearTaskMark_EveryJobTitleAgainstAGreenskeeperTaskAndAnOperatorTask(t *testing.T) {
	scenario := setUpMarkScenario(t)
	crew := setUpCrew(t)

	for _, code := range representativeTaskCodes {
		task := defaultTask(t, code)
		featureID, taskID := featureAndTask(t, scenario, code)
		for _, entry := range crewTitles {
			t.Run(entry.title+" on "+code, func(t *testing.T) {
				// Someone else made the mark, since anyone who may check a task may undo it
				mustExec(t, `DELETE FROM task_marks`)
				mustAddTaskMark(t, clubDate(t, 0), featureID, taskID, "done", scenario.otherUserID)

				statusCode, body := sendMarkRequest(http.MethodDelete, crew[entry.title].cookie, featureID, taskID, "")

				remaining := len(loadTaskMarks(t))
				if entry.isAdmin || entry.title == task.JobTitles {
					if statusCode != http.StatusNoContent {
						t.Fatalf("expected 204, got %d (body: %s)", statusCode, body)
					}
					if remaining != 0 {
						t.Errorf("the mark should be gone, found %d", remaining)
					}
					return
				}

				if statusCode != http.StatusForbidden {
					t.Fatalf("expected 403, got %d (body: %s)", statusCode, body)
				}
				if strings.TrimSpace(body) == auth.ClockInRequiredMessage {
					t.Errorf("a person who may not undo a task must not be told to clock in")
				}
				if remaining != 1 {
					t.Errorf("a refused undo must leave the mark, found %d", remaining)
				}
			})
		}
	}
}

func TestClearTaskMark_Access(t *testing.T) {
	scenario := setUpMarkScenario(t)
	featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")
	mustAddTaskMark(t, clubDate(t, 0), featureID, taskID, "done", scenario.otherUserID)
	offTheClock := newCrewMember(t, "operator.off@example.com", "operator", false)
	onTheClock := newCrewMember(t, "operator.on@example.com", "operator", true)
	admin := newCrewMember(t, "admin.off@example.com", "superintendent", false)

	testCases := []struct {
		name           string
		cookie         *http.Cookie
		expectedStatus int
	}{
		{"no session", nil, http.StatusUnauthorized},
		{"staff who are not clocked in", offTheClock.cookie, http.StatusForbidden},
		{"staff who are clocked in", onTheClock.cookie, http.StatusNoContent},
		{"an admin who is not clocked in", admin.cookie, http.StatusNoContent},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			statusCode, body := sendMarkRequest(http.MethodDelete, testCase.cookie, featureID, taskID, "")

			if statusCode != testCase.expectedStatus {
				t.Fatalf("expected %d, got %d", testCase.expectedStatus, statusCode)
			}
			if testCase.expectedStatus == http.StatusForbidden {
				if message := strings.TrimSpace(body); message != auth.ClockInRequiredMessage {
					t.Errorf("expected the message %q, got %q", auth.ClockInRequiredMessage, message)
				}
			}
		})
	}
}

func TestClearTaskMark_RemovesOnlyThatMark(t *testing.T) {
	scenario := setUpMarkScenario(t)
	operator := newCrewMember(t, "luke.operator@example.com", "operator", true)
	today := clubDate(t, 0)
	teeBoxFeatureID, mowedTaskID := featureAndTask(t, scenario, "tee-box-mowed")
	clearedTaskID := taskIDOf(t, "tee-box-cleared")
	mustAddTaskMark(t, today, teeBoxFeatureID, mowedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, today, teeBoxFeatureID, clearedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, today, scenario.holeOneBunkerOneID, scenario.bunkerRakedTaskID, "done", scenario.userID)

	statusCode, body := sendMarkRequest(http.MethodDelete, operator.cookie, teeBoxFeatureID, mowedTaskID, "")

	if statusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d (body: %s)", statusCode, body)
	}
	marks := loadTaskMarks(t)
	if len(marks) != 2 {
		t.Fatalf("expected the 2 other marks to remain, found %d", len(marks))
	}
	for _, mark := range marks {
		if mark.FeatureID == teeBoxFeatureID && mark.TaskID == mowedTaskID {
			t.Errorf("the mark that was undone is still there: %+v", mark)
		}
	}
}

func TestClearTaskMark_NothingToUndoIsStillSuccess(t *testing.T) {
	scenario := setUpMarkScenario(t)
	operator := newCrewMember(t, "luke.operator@example.com", "operator", true)
	featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")

	statusCode, body := sendMarkRequest(http.MethodDelete, operator.cookie, featureID, taskID, "")

	if statusCode != http.StatusNoContent {
		t.Errorf("expected 204, got %d (body: %s)", statusCode, body)
	}
	if count := len(loadTaskMarks(t)); count != 0 {
		t.Errorf("expected no marks, found %d", count)
	}
}

func TestClearTaskMark_OnlyUndoesTodaysMark(t *testing.T) {
	scenario := setUpMarkScenario(t)
	operator := newCrewMember(t, "luke.operator@example.com", "operator", true)
	featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")
	yesterday := clubDate(t, -1)
	mustAddTaskMark(t, yesterday, featureID, taskID, "done", scenario.otherUserID)
	mustAddTaskMark(t, clubDate(t, 0), featureID, taskID, "done", scenario.userID)

	statusCode, body := sendMarkRequest(http.MethodDelete, operator.cookie, featureID, taskID, "")

	if statusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d (body: %s)", statusCode, body)
	}
	marks := loadTaskMarks(t)
	if len(marks) != 1 || marks[0].Date != yesterday {
		t.Errorf("expected only yesterday's mark to remain, got %+v", marks)
	}
}

func TestClearTaskMark_FollowsTheClubsOwnTimezone(t *testing.T) {
	scenario := setUpMarkScenario(t)
	operator := newCrewMember(t, "luke.operator@example.com", "operator", true)
	featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")
	mustExec(t, `UPDATE courses SET timezone = $1`, farEastTimezone)
	clubToday := lookupText(t, `SELECT (now() AT TIME ZONE $1::text)::date::text`, farEastTimezone)
	otherZoneToday := lookupText(t, `SELECT (now() AT TIME ZONE $1::text)::date::text`, farWestTimezone)
	mustAddTaskMark(t, clubToday, featureID, taskID, "done", scenario.otherUserID)
	mustAddTaskMark(t, otherZoneToday, featureID, taskID, "done", scenario.userID)

	statusCode, body := sendMarkRequest(http.MethodDelete, operator.cookie, featureID, taskID, "")

	if statusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d (body: %s)", statusCode, body)
	}
	marks := loadTaskMarks(t)
	if len(marks) != 1 || marks[0].Date != otherZoneToday {
		t.Errorf("expected only the mark from the other zone's day to remain, got %+v", marks)
	}
}

func TestClearTaskMark_UndoesBothStatuses(t *testing.T) {
	for _, status := range bothStatuses {
		t.Run(status, func(t *testing.T) {
			scenario := setUpMarkScenario(t)
			operator := newCrewMember(t, "luke.operator@example.com", "operator", true)
			featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")
			mustAddTaskMark(t, clubDate(t, 0), featureID, taskID, status, scenario.userID)

			statusCode, body := sendMarkRequest(http.MethodDelete, operator.cookie, featureID, taskID, "")

			if statusCode != http.StatusNoContent {
				t.Fatalf("expected 204, got %d (body: %s)", statusCode, body)
			}
			if count := len(loadTaskMarks(t)); count != 0 {
				t.Errorf("the mark should be gone, found %d", count)
			}
		})
	}
}

func TestClearTaskMark_Errors(t *testing.T) {
	scenario := setUpMarkScenario(t)
	admin := newCrewMember(t, "admin@example.com", "superintendent", false)
	featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")
	greenTaskID := taskIDOf(t, "green-mowed")
	mustAddTaskMark(t, clubDate(t, 0), featureID, taskID, "done", scenario.userID)

	testCases := []struct {
		name           string
		featureID      string
		taskID         string
		expectedStatus int
	}{
		{"a feature that does not exist", nonexistentID, taskID, http.StatusNotFound},
		{"a task that does not exist", featureID, nonexistentID, http.StatusNotFound},
		{"a task for a different kind of feature", featureID, greenTaskID, http.StatusBadRequest},
		{"a feature id that is not an id", "banana", taskID, http.StatusBadRequest},
		{"a task id that is not an id", featureID, "banana", http.StatusBadRequest},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			statusCode, body := sendMarkRequest(http.MethodDelete, admin.cookie, testCase.featureID, testCase.taskID, "")

			if statusCode != testCase.expectedStatus {
				t.Errorf("expected %d, got %d (body: %s)", testCase.expectedStatus, statusCode, body)
			}
			if count := len(loadTaskMarks(t)); count != 1 {
				t.Errorf("a refused undo must leave the mark, found %d marks", count)
			}
		})
	}
}

func TestMarkRoutes_TheHoleMarksShowWhatWasMarkedAndUndone(t *testing.T) {
	scenario := setUpMarkScenario(t)
	operator := newCrewMember(t, "luke.operator@example.com", "operator", true)
	nameCrewMember(t, operator, "Luke Skywalker")
	featureID, taskID := featureAndTask(t, scenario, "tee-box-mowed")
	if statusCode, body := sendMarkRequest(http.MethodPut, operator.cookie, featureID, taskID, statusBody("done")); statusCode != http.StatusOK {
		t.Fatalf("expected 200 to mark it, got %d (body: %s)", statusCode, body)
	}

	afterMarking := fetchHoleMarks(t, scenario.holeOneID)

	if len(afterMarking.Marks) != 1 {
		t.Fatalf("expected the hole to show 1 mark, got %d", len(afterMarking.Marks))
	}
	shown := afterMarking.Marks[0]
	if shown.FeatureID != featureID || shown.TaskID != taskID || shown.Status != "done" || shown.UserName != "Luke Skywalker" {
		t.Errorf("the hole shows the wrong mark: %+v", shown)
	}

	if statusCode, body := sendMarkRequest(http.MethodDelete, operator.cookie, featureID, taskID, ""); statusCode != http.StatusNoContent {
		t.Fatalf("expected 204 to undo it, got %d (body: %s)", statusCode, body)
	}
	afterUndo := fetchHoleMarks(t, scenario.holeOneID)

	if len(afterUndo.Marks) != 0 {
		t.Errorf("expected the hole to show no marks after the undo, got %+v", afterUndo.Marks)
	}
}

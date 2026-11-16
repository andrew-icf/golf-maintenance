package router_test

import (
	"encoding/json"
	"net/http"
	"reflect"
	"sort"
	"strings"
	"testing"

	"golf-maintenance/backend/internal/auth"
	"golf-maintenance/backend/internal/router"
	"golf-maintenance/backend/internal/testutil"
)

// What /api/hole-tasks sends back
type dutyResponse struct {
	ID       string `json:"id"`
	Code     string `json:"code"`
	Name     string `json:"name"`
	Position int    `json:"position"`
}

type holeTaskResponse struct {
	ID               string   `json:"id"`
	Code             string   `json:"code"`
	FeatureType      string   `json:"feature_type"`
	Name             string   `json:"name"`
	AllowedJobTitles []string `json:"allowed_job_titles"`
	DutyID           string   `json:"duty_id"`
	Position         int      `json:"position"`
}

type holeTaskListResponse struct {
	Duties []dutyResponse     `json:"duties"`
	Tasks  []holeTaskResponse `json:"tasks"`
}

// The same response with each entry kept as it was sent, to check exactly which fields it has
type rawHoleTaskList struct {
	Duties []map[string]any `json:"duties"`
	Tasks  []map[string]any `json:"tasks"`
}

// The fields the page reads. They must not change by accident, so they are written out here.
var (
	expectedDutyFields = []string{"code", "id", "name", "position"}
	expectedTaskFields = []string{"allowed_job_titles", "code", "duty_id", "feature_type", "id", "name", "position"}
)

// Actions
// Asks for the list as an admin, who is never held at the clock-in rule, so the data is all that is
// being tested
func requestHoleTasks(t *testing.T) []byte {
	t.Helper()
	reader := newPerson(t, "task.reader@example.com", "admin")
	recorder := sendRequest(router.New(), http.MethodGet, "/api/hole-tasks", "", reader.cookie)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	return recorder.Body.Bytes()
}

func fetchHoleTaskList(t *testing.T) holeTaskListResponse {
	t.Helper()
	body := requestHoleTasks(t)

	var list holeTaskListResponse
	if err := json.Unmarshal(body, &list); err != nil {
		t.Fatalf("could not decode response %q: %v", string(body), err)
	}
	return list
}

func fetchRawHoleTaskList(t *testing.T) rawHoleTaskList {
	t.Helper()
	body := requestHoleTasks(t)

	var list rawHoleTaskList
	if err := json.Unmarshal(body, &list); err != nil {
		t.Fatalf("could not decode response %q: %v", string(body), err)
	}
	return list
}

func dutyCodesOf(list holeTaskListResponse) []string {
	codes := []string{}
	for _, duty := range list.Duties {
		codes = append(codes, duty.Code)
	}
	return codes
}

func taskCodesOf(list holeTaskListResponse) []string {
	codes := []string{}
	for _, task := range list.Tasks {
		codes = append(codes, task.Code)
	}
	return codes
}

func sortedKeysOf(entry map[string]any) []string {
	keys := []string{}
	for key := range entry {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func TestGetHoleTasks_Access(t *testing.T) {
	testutil.SetupTestDB(t)
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
			recorder := sendRequest(handler, http.MethodGet, "/api/hole-tasks", "", testCase.cookie)

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

func TestGetHoleTasks_SendsTheDefaultListInOrder(t *testing.T) {
	testutil.SetupTestDB(t)
	runDefaultTasksSeed(t)

	list := fetchHoleTaskList(t)

	duties := []storedDuty{}
	dutyCodeByID := map[string]string{}
	for _, duty := range list.Duties {
		duties = append(duties, storedDuty{Code: duty.Code, Name: duty.Name, Position: duty.Position})
		dutyCodeByID[duty.ID] = duty.Code
	}
	tasks := []storedTask{}
	for _, task := range list.Tasks {
		tasks = append(tasks, storedTask{
			Code:        task.Code,
			FeatureType: task.FeatureType,
			Name:        task.Name,
			JobTitles:   strings.Join(task.AllowedJobTitles, ","),
			DutyCode:    dutyCodeByID[task.DutyID],
			Position:    task.Position,
		})
	}

	if !reflect.DeepEqual(duties, expectedDefaultDuties) {
		t.Errorf("expected the duties %+v, got %+v", expectedDefaultDuties, duties)
	}
	if !reflect.DeepEqual(tasks, expectedDefaultTasks) {
		t.Errorf("expected the tasks %+v, got %+v", expectedDefaultTasks, tasks)
	}
}

func TestGetHoleTasks_EveryTaskPointsAtADutyInTheResponse(t *testing.T) {
	testutil.SetupTestDB(t)
	runDefaultTasksSeed(t)

	list := fetchHoleTaskList(t)

	dutyIDs := map[string]bool{}
	for _, duty := range list.Duties {
		dutyIDs[duty.ID] = true
	}
	for _, task := range list.Tasks {
		if task.DutyID == "" || !dutyIDs[task.DutyID] {
			t.Errorf("the task %s points at a duty that is not in the response: %q", task.Code, task.DutyID)
		}
	}
}

func TestGetHoleTasks_EveryDutyAndTaskHasItsOwnId(t *testing.T) {
	testutil.SetupTestDB(t)
	runDefaultTasksSeed(t)

	list := fetchHoleTaskList(t)

	ids := []string{}
	for _, duty := range list.Duties {
		ids = append(ids, duty.ID)
	}
	for _, task := range list.Tasks {
		ids = append(ids, task.ID)
	}
	seen := map[string]bool{}
	for _, id := range ids {
		if id == "" {
			t.Errorf("an entry has no id")
		}
		if seen[id] {
			t.Errorf("the id %q is used more than once", id)
		}
		seen[id] = true
	}
	// 7 duties and 17 tasks
	if len(ids) != 24 {
		t.Errorf("expected 24 entries, got %d", len(ids))
	}
}

func TestGetHoleTasks_OrderDoesNotDependOnTheOrderTheyWereAdded(t *testing.T) {
	testutil.SetupTestDB(t)
	dutyC := mustAddDuty(t, "duty-c", "Duty C", 3)
	dutyA := mustAddDuty(t, "duty-a", "Duty A", 1)
	dutyB := mustAddDuty(t, "duty-b", "Duty B", 2)
	mustAddHoleTask(t, "task-c", "green", "Task C", "{operator}", dutyC, 3)
	mustAddHoleTask(t, "task-a", "green", "Task A", "{operator}", dutyA, 1)
	mustAddHoleTask(t, "task-b", "green", "Task B", "{operator}", dutyB, 2)

	list := fetchHoleTaskList(t)

	if actual := dutyCodesOf(list); !reflect.DeepEqual(actual, []string{"duty-a", "duty-b", "duty-c"}) {
		t.Errorf("the duties are out of order: %v", actual)
	}
	if actual := taskCodesOf(list); !reflect.DeepEqual(actual, []string{"task-a", "task-b", "task-c"}) {
		t.Errorf("the tasks are out of order: %v", actual)
	}
}

func TestGetHoleTasks_EntriesWithTheSamePositionComeBackInCodeOrder(t *testing.T) {
	testutil.SetupTestDB(t)
	dutyZeta := mustAddDuty(t, "zeta", "Zeta", 1)
	mustAddDuty(t, "alpha", "Alpha", 1)
	mustAddHoleTask(t, "task-zeta", "green", "Zeta task", "{operator}", dutyZeta, 1)
	mustAddHoleTask(t, "task-alpha", "green", "Alpha task", "{operator}", dutyZeta, 1)

	list := fetchHoleTaskList(t)

	if actual := dutyCodesOf(list); !reflect.DeepEqual(actual, []string{"alpha", "zeta"}) {
		t.Errorf("duties with the same position should be in code order: %v", actual)
	}
	if actual := taskCodesOf(list); !reflect.DeepEqual(actual, []string{"task-alpha", "task-zeta"}) {
		t.Errorf("tasks with the same position should be in code order: %v", actual)
	}
}

func TestGetHoleTasks_ATaskKeepsTheJobTitlesItNamesInOrder(t *testing.T) {
	testutil.SetupTestDB(t)
	dutyID := mustAddDuty(t, "greens", "Greens", 1)
	mustAddHoleTask(t, "green-checked", "green", "Checked", "{operator,greenskeeper}", dutyID, 1)

	list := fetchHoleTaskList(t)

	if len(list.Tasks) != 1 || !reflect.DeepEqual(list.Tasks[0].AllowedJobTitles, []string{"operator", "greenskeeper"}) {
		t.Errorf("expected operator and greenskeeper in that order, got %+v", list.Tasks)
	}
}

func TestGetHoleTasks_ATaskWithNoJobTitlesHasAnEmptyListNotNull(t *testing.T) {
	testutil.SetupTestDB(t)
	dutyID := mustAddDuty(t, "greens", "Greens", 1)
	mustAddHoleTask(t, "green-inspected", "green", "Inspected", "{}", dutyID, 1)

	list := fetchHoleTaskList(t)

	if len(list.Tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(list.Tasks))
	}
	if titles := list.Tasks[0].AllowedJobTitles; titles == nil || len(titles) != 0 {
		t.Errorf("expected an empty list of job titles, got %v", titles)
	}
}

func TestGetHoleTasks_EmptyListsAreListsNotNull(t *testing.T) {
	testutil.SetupTestDB(t)

	list := fetchHoleTaskList(t)

	if list.Duties == nil || len(list.Duties) != 0 {
		t.Errorf("expected an empty list of duties, got %v", list.Duties)
	}
	if list.Tasks == nil || len(list.Tasks) != 0 {
		t.Errorf("expected an empty list of tasks, got %v", list.Tasks)
	}
}

func TestGetHoleTasks_SendsExactlyTheFieldsThePageReads(t *testing.T) {
	testutil.SetupTestDB(t)
	dutyID := mustAddDuty(t, "greens", "Greens", 1)
	mustAddHoleTask(t, "green-mowed", "green", "Mowed", "{operator}", dutyID, 1)

	list := fetchRawHoleTaskList(t)

	if len(list.Duties) != 1 || len(list.Tasks) != 1 {
		t.Fatalf("expected 1 duty and 1 task, got %d and %d", len(list.Duties), len(list.Tasks))
	}
	if actual := sortedKeysOf(list.Duties[0]); !reflect.DeepEqual(actual, expectedDutyFields) {
		t.Errorf("a duty has the fields %v, expected %v", actual, expectedDutyFields)
	}
	if actual := sortedKeysOf(list.Tasks[0]); !reflect.DeepEqual(actual, expectedTaskFields) {
		t.Errorf("a task has the fields %v, expected %v", actual, expectedTaskFields)
	}
}

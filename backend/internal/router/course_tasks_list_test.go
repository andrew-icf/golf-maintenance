package router_test

import (
	"net/http"
	"reflect"
	"sort"
	"testing"
)

// The fields the page reads. They must not change by accident, so they are written out here.
var (
	expectedCourseTasksFields    = []string{"date", "marks", "tasks"}
	expectedCourseTaskFields     = []string{"allowed_job_titles", "code", "id", "name", "position"}
	expectedCourseTaskMarkFields = []string{"marked_at", "status", "task_id", "user_id", "user_name"}
)

// Actions
func getCourseTasks(t *testing.T, person signedIn) map[string]any {
	t.Helper()
	recorder := sendRequest(person.handler, http.MethodGet, "/api/course-tasks", "", person.cookie)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	return decodeJSONObject(t, recorder.Body.Bytes())
}

// The objects in a list the answer sent. A list that is missing or null fails the test.
func objectsIn(t *testing.T, value any) []map[string]any {
	t.Helper()
	list, ok := value.([]any)
	if !ok || list == nil {
		t.Fatalf("expected a list, got %#v", value)
	}
	objects := []map[string]any{}
	for _, item := range list {
		object, ok := item.(map[string]any)
		if !ok {
			t.Fatalf("expected a list of objects, got %#v", item)
		}
		objects = append(objects, object)
	}
	return objects
}

func courseTaskSortedKeys(object map[string]any) []string {
	keys := []string{}
	for key := range object {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func TestCourseTasksList_SendsTheTasksInOrderWithWhoMayCheckThem(t *testing.T) {
	staff := setUpClockedInStaff(t)
	insertCourse(t, "Course A")
	runDefaultCourseTasksSeed(t)

	body := getCourseTasks(t, staff)

	names := []string{}
	for _, task := range objectsIn(t, body["tasks"]) {
		names = append(names, task["name"].(string))
		if titles := task["allowed_job_titles"]; !reflect.DeepEqual(titles, []any{"landscaper", "greenskeeper"}) {
			t.Errorf("%v: expected landscapers and greenskeepers, got %v", task["name"], titles)
		}
	}
	if !reflect.DeepEqual(names, defaultCourseTaskNames) {
		t.Errorf("expected %v, got %v", defaultCourseTaskNames, names)
	}
	if expected := clubDate(t, 0); body["date"] != expected {
		t.Errorf("expected the club's date %q, got %v", expected, body["date"])
	}
}

func TestCourseTasksList_SendsEmptyListsWhenThereAreNoTasks(t *testing.T) {
	staff := setUpClockedInStaff(t)
	insertCourse(t, "Course A")

	body := getCourseTasks(t, staff)

	if tasks := objectsIn(t, body["tasks"]); len(tasks) != 0 {
		t.Errorf("expected no tasks, got %v", tasks)
	}
	if marks := objectsIn(t, body["marks"]); len(marks) != 0 {
		t.Errorf("expected no marks, got %v", marks)
	}
}

func TestCourseTasksList_SendsTodaysMarksWithWhoMadeThem(t *testing.T) {
	staff := setUpClockedInStaff(t)
	courseID := insertCourse(t, "Course A")
	taskID := mustAddCourseTask(t, courseID, "mowing", "Mowing", []string{"landscaper"}, 1)
	luke := newNamedPerson(t, "luke.skywalker@example.com", "staff", "Luke Skywalker")
	mustAddCourseTaskMark(t, clubDate(t, 0), taskID, "not_today", luke.id)

	marks := objectsIn(t, getCourseTasks(t, staff)["marks"])

	if len(marks) != 1 {
		t.Fatalf("expected 1 mark, got %d", len(marks))
	}
	mark := marks[0]
	if mark["task_id"] != taskID || mark["status"] != "not_today" ||
		mark["user_id"] != luke.id || mark["user_name"] != "Luke Skywalker" {
		t.Errorf("the mark does not say what was marked and by whom: %v", mark)
	}
}

func TestCourseTasksList_LeavesOutMarksFromOtherDays(t *testing.T) {
	staff := setUpClockedInStaff(t)
	courseID := insertCourse(t, "Course A")
	taskID := mustAddCourseTask(t, courseID, "mowing", "Mowing", []string{"landscaper"}, 1)
	mustAddCourseTaskMark(t, clubDate(t, -1), taskID, "done", staff.id)
	mustAddCourseTaskMark(t, clubDate(t, 1), taskID, "done", staff.id)

	marks := objectsIn(t, getCourseTasks(t, staff)["marks"])

	if len(marks) != 0 {
		t.Errorf("expected only today's marks, got %v", marks)
	}
}

func TestCourseTasksList_TheDayFollowsTheClubsTimezone(t *testing.T) {
	staff := setUpClockedInStaff(t)
	courseID := insertCourse(t, "Course A")
	taskID := mustAddCourseTask(t, courseID, "mowing", "Mowing", []string{"landscaper"}, 1)

	mustExec(t, `UPDATE courses SET timezone = $1`, farEastTimezone)
	eastDate := clubDate(t, 0)
	mustAddCourseTaskMark(t, eastDate, taskID, "done", staff.id)
	eastBody := getCourseTasks(t, staff)

	mustExec(t, `UPDATE courses SET timezone = $1`, farWestTimezone)
	westDate := clubDate(t, 0)
	westBody := getCourseTasks(t, staff)

	if eastDate == westDate {
		t.Fatalf("the two time zones should be on different days, both gave %s", eastDate)
	}
	if eastBody["date"] != eastDate || westBody["date"] != westDate {
		t.Errorf("expected the dates %s and %s, got %v and %v", eastDate, westDate, eastBody["date"], westBody["date"])
	}
	if marks := objectsIn(t, eastBody["marks"]); len(marks) != 1 {
		t.Errorf("expected the mark on the club's day, got %v", marks)
	}
	if marks := objectsIn(t, westBody["marks"]); len(marks) != 0 {
		t.Errorf("expected no marks on the other day, got %v", marks)
	}
}

func TestCourseTasksList_EveryoneSeesEveryTaskAndMark(t *testing.T) {
	staff := setUpClockedInStaff(t)
	setJobTitle(t, staff.id, "mechanic")
	courseID := insertCourse(t, "Course A")
	taskID := mustAddCourseTask(t, courseID, "mowing", "Mowing", []string{"landscaper"}, 1)
	luke := newPerson(t, "luke.skywalker@example.com", "staff")
	mustAddCourseTaskMark(t, clubDate(t, 0), taskID, "done", luke.id)

	body := getCourseTasks(t, staff)

	if tasks := objectsIn(t, body["tasks"]); len(tasks) != 1 {
		t.Errorf("a mechanic should still see the task, got %v", tasks)
	}
	if marks := objectsIn(t, body["marks"]); len(marks) != 1 {
		t.Errorf("a mechanic should still see the mark, got %v", marks)
	}
}

func TestCourseTasksList_SendsTheFieldsThePageReads(t *testing.T) {
	staff := setUpClockedInStaff(t)
	courseID := insertCourse(t, "Course A")
	taskID := mustAddCourseTask(t, courseID, "mowing", "Mowing", []string{"landscaper"}, 1)
	mustAddCourseTaskMark(t, clubDate(t, 0), taskID, "done", staff.id)

	body := getCourseTasks(t, staff)

	if actual := courseTaskSortedKeys(body); !reflect.DeepEqual(actual, expectedCourseTasksFields) {
		t.Errorf("expected the fields %v, got %v", expectedCourseTasksFields, actual)
	}
	if actual := courseTaskSortedKeys(objectsIn(t, body["tasks"])[0]); !reflect.DeepEqual(actual, expectedCourseTaskFields) {
		t.Errorf("expected the task fields %v, got %v", expectedCourseTaskFields, actual)
	}
	if actual := courseTaskSortedKeys(objectsIn(t, body["marks"])[0]); !reflect.DeepEqual(actual, expectedCourseTaskMarkFields) {
		t.Errorf("expected the mark fields %v, got %v", expectedCourseTaskMarkFields, actual)
	}
}

func TestCourseTasksList_IsNotFoundWhenThereIsNoCourse(t *testing.T) {
	staff := setUpClockedInStaff(t)

	recorder := sendRequest(staff.handler, http.MethodGet, "/api/course-tasks", "", staff.cookie)

	if recorder.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", recorder.Code)
	}
}

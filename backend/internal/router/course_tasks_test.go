package router_test

import (
	"context"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/testutil"
)

// The names of the rules in the course tasks migration
const (
	courseTaskCodeRule          = "course_tasks_code_unique"
	courseTaskCodeFormatRule    = "course_tasks_code_format"
	courseTaskNameRule          = "course_tasks_name_not_blank"
	courseTaskTitlesRule        = "course_tasks_allowed_job_titles_not_empty"
	courseTaskCourseRule        = "course_tasks_course_id_fkey"
	courseTaskOneMarkPerDayRule = "course_task_marks_unique_per_day"
	courseTaskMarkTaskRule      = "course_task_marks_course_task_id_fkey"
	courseTaskMarkUserRule      = "course_task_marks_user_id_fkey"
)

// The error code Postgres gives for a word that is not one of an enum's values
const invalidEnumErrorCode = "22P02"

// A well-formed id that belongs to nothing
const courseTaskUnknownID = "00000000-0000-0000-0000-000000000001"

var defaultCourseTaskNames = []string{
	"Mowing",
	"Edging",
	"Wear Repair",
	"Irrigation management",
	"Gardening",
	"Pruning",
	"General Clean up",
	"Garbage",
}

type courseTaskScenario struct {
	courseID    string
	taskID      string
	userID      string
	otherUserID string
}

func setUpCourseTaskScenario(t *testing.T) courseTaskScenario {
	t.Helper()
	testutil.SetupTestDB(t)
	courseID := insertedID(t, `INSERT INTO courses (name) VALUES ($1) RETURNING id`, "Course A")

	return courseTaskScenario{
		courseID:    courseID,
		taskID:      mustAddCourseTask(t, courseID, "mowing", "Mowing", []string{"landscaper"}, 1),
		userID:      newPerson(t, "yoda@example.com", "staff").id,
		otherUserID: newPerson(t, "luke.skywalker@example.com", "staff").id,
	}
}

func addCourseTask(courseID, code, name string, jobTitles []string, position int) error {
	return execSQL(
		`INSERT INTO course_tasks (course_id, code, name, allowed_job_titles, position)
		 VALUES ($1, $2, $3, $4::text[]::job_title_type[], $5)`,
		courseID, code, name, jobTitles, position,
	)
}

func mustAddCourseTask(t *testing.T, courseID, code, name string, jobTitles []string, position int) string {
	t.Helper()
	return insertedID(t,
		`INSERT INTO course_tasks (course_id, code, name, allowed_job_titles, position)
		 VALUES ($1, $2, $3, $4::text[]::job_title_type[], $5) RETURNING id`,
		courseID, code, name, jobTitles, position,
	)
}

func addCourseTaskMark(day, taskID, status, userID string) error {
	return execSQL(
		`INSERT INTO course_task_marks (mark_date, course_task_id, status, user_id)
		 VALUES ($1::text::date, $2, $3::text::task_mark_status, $4)`,
		day, taskID, status, userID,
	)
}

func mustAddCourseTaskMark(t *testing.T, day, taskID, status, userID string) {
	t.Helper()
	if err := addCourseTaskMark(day, taskID, status, userID); err != nil {
		t.Fatalf("could not add the course task mark: %v", err)
	}
}

func loadCourseTaskNames(t *testing.T) []string {
	t.Helper()
	rows, err := db.Pool.Query(context.Background(), `SELECT name FROM course_tasks ORDER BY position`)
	if err != nil {
		t.Fatalf("could not read course tasks: %v", err)
	}
	defer rows.Close()

	names := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatalf("could not read a course task: %v", err)
		}
		names = append(names, name)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("could not read course tasks: %v", err)
	}
	return names
}

// Runs the default course tasks the way the seed file is run by hand
func runDefaultCourseTasksSeed(t *testing.T) {
	t.Helper()
	seed, err := os.ReadFile(filepath.Join("..", "..", "seed", "default_course_tasks.sql"))
	if err != nil {
		t.Fatalf("could not read the seed file: %v", err)
	}
	if _, err := db.Pool.Exec(context.Background(), string(seed)); err != nil {
		t.Fatalf("could not run the seed file: %v", err)
	}
}

// ---- Course tasks ----

func TestCourseTasks_CodeIsUniquePerCourse(t *testing.T) {
	scenario := setUpCourseTaskScenario(t)

	complaint := featureComplaint(t,
		addCourseTask(scenario.courseID, "mowing", "Mowing again", []string{"landscaper"}, 2),
	)

	if complaint != courseTaskCodeRule {
		t.Errorf("expected %q to refuse it, got %q", courseTaskCodeRule, complaint)
	}
	if count := countRows(t, `SELECT COUNT(*) FROM course_tasks`); count != 1 {
		t.Errorf("expected only the first task to stay, found %d", count)
	}
}

func TestCourseTasks_TheSameCodeCanBeUsedInAnotherCourse(t *testing.T) {
	setUpCourseTaskScenario(t)
	otherCourseID := insertedID(t, `INSERT INTO courses (name) VALUES ($1) RETURNING id`, "Course B")

	mustAddCourseTask(t, otherCourseID, "mowing", "Mowing", []string{"landscaper"}, 1)

	if count := countRows(t, `SELECT COUNT(*) FROM course_tasks WHERE code = 'mowing'`); count != 2 {
		t.Errorf("expected each course to have its own mowing task, found %d", count)
	}
}

func TestCourseTasks_CodeMustBeLowercaseWithUnderscores(t *testing.T) {
	scenario := setUpCourseTaskScenario(t)

	for _, code := range []string{"Mowing", "1mowing", "wear repair", "wear-repair", "_mowing", ""} {
		t.Run(code, func(t *testing.T) {
			complaint := featureComplaint(t,
				addCourseTask(scenario.courseID, code, "Something", []string{"landscaper"}, 2),
			)
			if complaint != courseTaskCodeFormatRule {
				t.Errorf("expected %q to refuse the code %q, got %q", courseTaskCodeFormatRule, code, complaint)
			}
		})
	}
}

func TestCourseTasks_NameCannotBeBlank(t *testing.T) {
	scenario := setUpCourseTaskScenario(t)

	for _, name := range []string{"", "   "} {
		complaint := featureComplaint(t,
			addCourseTask(scenario.courseID, "edging", name, []string{"landscaper"}, 2),
		)
		if complaint != courseTaskNameRule {
			t.Errorf("expected %q to refuse the name %q, got %q", courseTaskNameRule, name, complaint)
		}
	}
}

func TestCourseTasks_NeedAtLeastOneAllowedJobTitle(t *testing.T) {
	scenario := setUpCourseTaskScenario(t)

	complaint := featureComplaint(t,
		addCourseTask(scenario.courseID, "edging", "Edging", []string{}, 2),
	)

	if complaint != courseTaskTitlesRule {
		t.Errorf("expected %q to refuse it, got %q", courseTaskTitlesRule, complaint)
	}
}

func TestCourseTasks_NeedARealCourse(t *testing.T) {
	setUpCourseTaskScenario(t)

	complaint := featureComplaint(t,
		addCourseTask(courseTaskUnknownID, "edging", "Edging", []string{"landscaper"}, 2),
	)

	if complaint != courseTaskCourseRule {
		t.Errorf("expected %q to refuse it, got %q", courseTaskCourseRule, complaint)
	}
}

func TestCourseTasks_AreRemovedWithTheirCourse(t *testing.T) {
	scenario := setUpCourseTaskScenario(t)
	mustAddCourseTaskMark(t, markDay, scenario.taskID, "done", scenario.userID)

	mustExec(t, `DELETE FROM courses WHERE id = $1`, scenario.courseID)

	if count := countRows(t, `SELECT COUNT(*) FROM course_tasks`); count != 0 {
		t.Errorf("expected the course's tasks to go with it, found %d", count)
	}
	if count := countRows(t, `SELECT COUNT(*) FROM course_task_marks`); count != 0 {
		t.Errorf("expected the course's marks to go with it, found %d", count)
	}
}

// ---- Course task marks ----

func TestCourseTaskMarks_OnlyOneMarkPerTaskAndDay(t *testing.T) {
	scenario := setUpCourseTaskScenario(t)
	mustAddCourseTaskMark(t, markDay, scenario.taskID, "done", scenario.userID)

	complaint := featureComplaint(t,
		addCourseTaskMark(markDay, scenario.taskID, "not_today", scenario.otherUserID),
	)

	if complaint != courseTaskOneMarkPerDayRule {
		t.Errorf("expected %q to refuse it, got %q", courseTaskOneMarkPerDayRule, complaint)
	}
	if count := countRows(t, `SELECT COUNT(*) FROM course_task_marks WHERE status = 'done' AND user_id = $1`, scenario.userID); count != 1 {
		t.Errorf("the first mark must stay as it was, found %d done marks by its user", count)
	}
}

func TestCourseTaskMarks_ATaskCanBeMarkedOnAnotherDay(t *testing.T) {
	scenario := setUpCourseTaskScenario(t)
	mustAddCourseTaskMark(t, markDay, scenario.taskID, "done", scenario.userID)

	mustAddCourseTaskMark(t, otherMarkDay, scenario.taskID, "done", scenario.userID)

	if count := countRows(t, `SELECT COUNT(*) FROM course_task_marks`); count != 2 {
		t.Errorf("expected a mark for each day, found %d", count)
	}
}

func TestCourseTaskMarks_StatusMustBeDoneOrNotToday(t *testing.T) {
	scenario := setUpCourseTaskScenario(t)

	err := addCourseTaskMark(markDay, scenario.taskID, "late", scenario.userID)

	if code := databaseErrorCode(t, err); code != invalidEnumErrorCode {
		t.Errorf("expected error code %q, got %q", invalidEnumErrorCode, code)
	}
	if count := countRows(t, `SELECT COUNT(*) FROM course_task_marks`); count != 0 {
		t.Errorf("expected no mark to be saved, found %d", count)
	}
}

func TestCourseTaskMarks_NeedARealTaskAndARealUser(t *testing.T) {
	scenario := setUpCourseTaskScenario(t)

	taskComplaint := featureComplaint(t,
		addCourseTaskMark(markDay, courseTaskUnknownID, "done", scenario.userID),
	)
	if taskComplaint != courseTaskMarkTaskRule {
		t.Errorf("expected %q to refuse it, got %q", courseTaskMarkTaskRule, taskComplaint)
	}

	userComplaint := featureComplaint(t,
		addCourseTaskMark(markDay, scenario.taskID, "done", courseTaskUnknownID),
	)
	if userComplaint != courseTaskMarkUserRule {
		t.Errorf("expected %q to refuse it, got %q", courseTaskMarkUserRule, userComplaint)
	}
}

func TestCourseTaskMarks_AreRemovedWithTheirTask(t *testing.T) {
	scenario := setUpCourseTaskScenario(t)
	mustAddCourseTaskMark(t, markDay, scenario.taskID, "done", scenario.userID)

	mustExec(t, `DELETE FROM course_tasks WHERE id = $1`, scenario.taskID)

	if count := countRows(t, `SELECT COUNT(*) FROM course_task_marks`); count != 0 {
		t.Errorf("expected the task's marks to go with it, found %d", count)
	}
}

func TestCourseTaskMarks_AMarkTakesTheTimeItWasMade(t *testing.T) {
	scenario := setUpCourseTaskScenario(t)

	mustAddCourseTaskMark(t, markDay, scenario.taskID, "done", scenario.userID)

	count := countRows(t, `SELECT COUNT(*) FROM course_task_marks WHERE marked_at BETWEEN now() - interval '1 minute' AND now()`)
	if count != 1 {
		t.Errorf("expected the mark to be stamped with the time it was made, found %d marks in the last minute", count)
	}
}

// ---- The default course tasks ----

func TestDefaultCourseTasksSeed_AddsTheListInOrder(t *testing.T) {
	testutil.SetupTestDB(t)
	insertedID(t, `INSERT INTO courses (name) VALUES ($1) RETURNING id`, "Course A")

	runDefaultCourseTasksSeed(t)

	if actual := loadCourseTaskNames(t); !reflect.DeepEqual(actual, defaultCourseTaskNames) {
		t.Errorf("expected %v, got %v", defaultCourseTaskNames, actual)
	}
	count := countRows(t, `SELECT COUNT(*) FROM course_tasks WHERE allowed_job_titles = ARRAY['landscaper', 'greenskeeper']::job_title_type[]`)
	if count != len(defaultCourseTaskNames) {
		t.Errorf("expected landscapers and greenskeepers on all %d tasks, found %d", len(defaultCourseTaskNames), count)
	}
}

func TestDefaultCourseTasksSeed_CanBeRunAgain(t *testing.T) {
	testutil.SetupTestDB(t)
	insertedID(t, `INSERT INTO courses (name) VALUES ($1) RETURNING id`, "Course A")
	runDefaultCourseTasksSeed(t)
	mustExec(t, `UPDATE course_tasks SET name = 'Old name', position = 99 WHERE code = 'mowing'`)

	runDefaultCourseTasksSeed(t)

	if actual := loadCourseTaskNames(t); !reflect.DeepEqual(actual, defaultCourseTaskNames) {
		t.Errorf("expected a second run to put things back, got %v", actual)
	}
}

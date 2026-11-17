package router_test

import (
	"context"
	"reflect"
	"testing"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/testutil"
)

// The error code Postgres gives for a time zone name it does not know, and the days the tests use
const (
	invalidParameterErrorCode = "22023"
	defaultClubTimezone       = "Pacific/Honolulu"
	markDay                   = "2026-11-15"
	otherMarkDay              = "2026-11-16"
)

// The names of the rules in the migration, so a test can tell which one refused something
const (
	oneMarkPerDayRule = "task_marks_unique_per_day"
	markFeatureRule   = "task_marks_hole_feature_id_fkey"
	markTaskRule      = "task_marks_task_id_fkey"
	markUserRule      = "task_marks_user_id_fkey"
)

var realTimezoneCases = []string{"America/Denver", "Pacific/Honolulu", "UTC", "Europe/London"}

var unknownTimezoneCases = []string{"Mars/Olympus_Mons", "not a zone"}

// Words that are not a status. A status is exactly done or not_today.
var invalidStatusCases = []struct {
	name   string
	status string
}{
	{"a word that is not a status", "finished"},
	{"a status in capitals", "DONE"},
	{"an empty status", ""},
}

var requiredMarkColumnCases = []string{"mark_date", "hole_feature_id", "task_id", "status", "user_id"}

type storedMark struct {
	Date      string
	FeatureID string
	TaskID    string
	Status    string
	UserID    string
}

// Two holes with the default tasks, a tee box on each, two bunkers on the first, and two people
type markScenario struct {
	userID              string
	otherUserID         string
	holeOneID           string
	holeTwoID           string
	holeOneTeeBoxID     string
	holeTwoTeeBoxID     string
	holeOneBunkerOneID  string
	holeOneBunkerTwoID  string
	teeBoxMowedTaskID   string
	teeBoxClearedTaskID string
	bunkerRakedTaskID   string
}

// Actions
func lookupText(t *testing.T, query string, args ...any) string {
	t.Helper()
	var value string
	if err := db.Pool.QueryRow(context.Background(), query, args...).Scan(&value); err != nil {
		t.Fatalf("could not look up a value: %v", err)
	}
	return value
}

func featureIDOf(t *testing.T, holeID, featureType string, position int) string {
	t.Helper()
	return lookupText(t,
		`SELECT id::text FROM hole_features WHERE hole_id = $1 AND feature_type = $2::text::hole_feature_type AND position = $3`,
		holeID, featureType, position,
	)
}

func taskIDOf(t *testing.T, code string) string {
	t.Helper()
	return lookupText(t, `SELECT id::text FROM hole_tasks WHERE code = $1`, code)
}

func setUpMarkScenario(t *testing.T) markScenario {
	t.Helper()
	testutil.SetupTestDB(t)
	runDefaultTasksSeed(t)
	holeIDs := buildClub(t, []int{2}).HoleIDs[0]
	mustAddHoleFeature(t, holeIDs[0], "bunker", 1)
	mustAddHoleFeature(t, holeIDs[0], "bunker", 2)

	return markScenario{
		userID:              newPerson(t, "yoda@example.com", "staff").id,
		otherUserID:         newPerson(t, "luke.skywalker@example.com", "staff").id,
		holeOneID:           holeIDs[0],
		holeTwoID:           holeIDs[1],
		holeOneTeeBoxID:     featureIDOf(t, holeIDs[0], "tee_box", 1),
		holeTwoTeeBoxID:     featureIDOf(t, holeIDs[1], "tee_box", 1),
		holeOneBunkerOneID:  featureIDOf(t, holeIDs[0], "bunker", 1),
		holeOneBunkerTwoID:  featureIDOf(t, holeIDs[0], "bunker", 2),
		teeBoxMowedTaskID:   taskIDOf(t, "tee-box-mowed"),
		teeBoxClearedTaskID: taskIDOf(t, "tee-box-cleared"),
		bunkerRakedTaskID:   taskIDOf(t, "bunker-raked-machine"),
	}
}

// Every value is left open so a test can pass nil for a column it wants left empty
func addTaskMark(markDate, featureID, taskID, status, userID any) error {
	return execSQL(
		`INSERT INTO task_marks (mark_date, hole_feature_id, task_id, status, user_id)
		 VALUES ($1::text::date, $2, $3, $4::text::task_mark_status, $5)`,
		markDate, featureID, taskID, status, userID,
	)
}

func mustAddTaskMark(t *testing.T, markDate, featureID, taskID, status, userID string) {
	t.Helper()
	if err := addTaskMark(markDate, featureID, taskID, status, userID); err != nil {
		t.Fatalf("could not add a mark: %v", err)
	}
}

func loadTaskMarks(t *testing.T) []storedMark {
	t.Helper()
	rows, err := db.Pool.Query(
		context.Background(),
		`SELECT mark_date::text, hole_feature_id::text, task_id::text, status::text, user_id::text
		 FROM task_marks
		 ORDER BY mark_date, hole_feature_id, task_id`,
	)
	if err != nil {
		t.Fatalf("could not read marks: %v", err)
	}
	defer rows.Close()

	marks := []storedMark{}
	for rows.Next() {
		var mark storedMark
		if err := rows.Scan(&mark.Date, &mark.FeatureID, &mark.TaskID, &mark.Status, &mark.UserID); err != nil {
			t.Fatalf("could not read a mark: %v", err)
		}
		marks = append(marks, mark)
	}
	return marks
}

func marksOnFeature(t *testing.T, featureID string) int {
	t.Helper()
	return countRows(t, `SELECT COUNT(*) FROM task_marks WHERE hole_feature_id = $1`, featureID)
}

func marksForTask(t *testing.T, taskID string) int {
	t.Helper()
	return countRows(t, `SELECT COUNT(*) FROM task_marks WHERE task_id = $1`, taskID)
}

func TestCourseTimezone_DefaultsToHonolulu(t *testing.T) {
	testutil.SetupTestDB(t)
	courseID := insertCourse(t, testClubName)

	actual := lookupText(t, `SELECT timezone FROM courses WHERE id = $1`, courseID)

	if actual != defaultClubTimezone {
		t.Errorf("expected %q, got %q", defaultClubTimezone, actual)
	}
}

func TestCourseTimezone_ARealTimezoneIsAccepted(t *testing.T) {
	for _, timezone := range realTimezoneCases {
		t.Run(timezone, func(t *testing.T) {
			testutil.SetupTestDB(t)
			courseID := insertCourse(t, testClubName)

			mustExec(t, `UPDATE courses SET timezone = $1 WHERE id = $2`, timezone, courseID)

			if actual := lookupText(t, `SELECT timezone FROM courses WHERE id = $1`, courseID); actual != timezone {
				t.Errorf("expected %q, got %q", timezone, actual)
			}
		})
	}
}

func TestCourseTimezone_ATimezoneThatDoesNotExistIsRefused(t *testing.T) {
	for _, timezone := range unknownTimezoneCases {
		t.Run(timezone, func(t *testing.T) {
			testutil.SetupTestDB(t)
			courseID := insertCourse(t, testClubName)

			code := databaseErrorCode(t, execSQL(`UPDATE courses SET timezone = $1 WHERE id = $2`, timezone, courseID))

			if code != invalidParameterErrorCode {
				t.Errorf("expected error code %q, got %q", invalidParameterErrorCode, code)
			}
			if actual := lookupText(t, `SELECT timezone FROM courses WHERE id = $1`, courseID); actual != defaultClubTimezone {
				t.Errorf("a refused timezone must not be saved, found %q", actual)
			}
		})
	}
}

func TestCourseTimezone_CannotBeLeftEmpty(t *testing.T) {
	testutil.SetupTestDB(t)
	courseID := insertCourse(t, testClubName)

	code := databaseErrorCode(t, execSQL(`UPDATE courses SET timezone = NULL WHERE id = $1`, courseID))

	if code != leftEmptyErrorCode {
		t.Errorf("expected error code %q, got %q", leftEmptyErrorCode, code)
	}
}

func TestTaskMarks_AMarkRecordsTheDayTheStatusAndWho(t *testing.T) {
	scenario := setUpMarkScenario(t)

	mustAddTaskMark(t, markDay, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)

	expected := []storedMark{
		{markDay, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID},
	}
	if actual := loadTaskMarks(t); !reflect.DeepEqual(actual, expected) {
		t.Errorf("expected %+v, got %+v", expected, actual)
	}
}

func TestTaskMarks_BothStatusesAreAccepted(t *testing.T) {
	for _, status := range []string{"done", "not_today"} {
		t.Run(status, func(t *testing.T) {
			scenario := setUpMarkScenario(t)

			mustAddTaskMark(t, markDay, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, status, scenario.userID)

			marks := loadTaskMarks(t)
			if len(marks) != 1 || marks[0].Status != status {
				t.Errorf("expected one mark with the status %q, got %+v", status, marks)
			}
		})
	}
}

func TestTaskMarks_AMarkTakesTheTimeItWasMade(t *testing.T) {
	scenario := setUpMarkScenario(t)

	mustAddTaskMark(t, markDay, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)

	count := countRows(t, `SELECT COUNT(*) FROM task_marks WHERE marked_at BETWEEN now() - interval '1 minute' AND now()`)
	if count != 1 {
		t.Errorf("expected the mark to be stamped with the time it was made, found %d marks in the last minute", count)
	}
}

func TestTaskMarks_OnlyOneMarkPerTaskFeatureAndDay(t *testing.T) {
	scenario := setUpMarkScenario(t)
	mustAddTaskMark(t, markDay, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)

	complaint := featureComplaint(t,
		addTaskMark(markDay, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "not_today", scenario.otherUserID),
	)

	if complaint != oneMarkPerDayRule {
		t.Errorf("expected %q to refuse it, got %q", oneMarkPerDayRule, complaint)
	}
	expected := []storedMark{
		{markDay, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID},
	}
	if actual := loadTaskMarks(t); !reflect.DeepEqual(actual, expected) {
		t.Errorf("the first mark must stay as it was, got %+v", actual)
	}
}

func TestTaskMarks_TheSameTaskCanBeMarkedAgainOnAnotherDayFeatureOrTask(t *testing.T) {
	t.Run("on another day", func(t *testing.T) {
		scenario := setUpMarkScenario(t)
		mustAddTaskMark(t, markDay, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)

		mustAddTaskMark(t, otherMarkDay, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)

		if count := countRows(t, `SELECT COUNT(*) FROM task_marks`); count != 2 {
			t.Errorf("expected 2 marks, found %d", count)
		}
	})

	t.Run("on another feature of the same kind", func(t *testing.T) {
		scenario := setUpMarkScenario(t)
		mustAddTaskMark(t, markDay, scenario.holeOneBunkerOneID, scenario.bunkerRakedTaskID, "done", scenario.userID)

		mustAddTaskMark(t, markDay, scenario.holeOneBunkerTwoID, scenario.bunkerRakedTaskID, "done", scenario.userID)

		if count := countRows(t, `SELECT COUNT(*) FROM task_marks`); count != 2 {
			t.Errorf("expected 2 marks, found %d", count)
		}
	})

	t.Run("for another task on the same feature", func(t *testing.T) {
		scenario := setUpMarkScenario(t)
		mustAddTaskMark(t, markDay, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)

		mustAddTaskMark(t, markDay, scenario.holeOneTeeBoxID, scenario.teeBoxClearedTaskID, "done", scenario.userID)

		if count := countRows(t, `SELECT COUNT(*) FROM task_marks`); count != 2 {
			t.Errorf("expected 2 marks, found %d", count)
		}
	})
}

func TestTaskMarks_AStatusThatIsNotDoneOrNotTodayIsRefused(t *testing.T) {
	for _, testCase := range invalidStatusCases {
		t.Run(testCase.name, func(t *testing.T) {
			scenario := setUpMarkScenario(t)

			code := databaseErrorCode(t,
				addTaskMark(markDay, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, testCase.status, scenario.userID),
			)

			if code != notInEnumErrorCode {
				t.Errorf("expected error code %q, got %q", notInEnumErrorCode, code)
			}
		})
	}
}

func TestTaskMarks_NeedARealFeatureTaskAndPerson(t *testing.T) {
	t.Run("a feature that does not exist", func(t *testing.T) {
		scenario := setUpMarkScenario(t)

		complaint := featureComplaint(t,
			addTaskMark(markDay, nonexistentID, scenario.teeBoxMowedTaskID, "done", scenario.userID),
		)

		if complaint != markFeatureRule {
			t.Errorf("expected %q to refuse it, got %q", markFeatureRule, complaint)
		}
	})

	t.Run("a task that does not exist", func(t *testing.T) {
		scenario := setUpMarkScenario(t)

		complaint := featureComplaint(t,
			addTaskMark(markDay, scenario.holeOneTeeBoxID, nonexistentID, "done", scenario.userID),
		)

		if complaint != markTaskRule {
			t.Errorf("expected %q to refuse it, got %q", markTaskRule, complaint)
		}
	})

	t.Run("a person who does not exist", func(t *testing.T) {
		scenario := setUpMarkScenario(t)

		complaint := featureComplaint(t,
			addTaskMark(markDay, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", nonexistentID),
		)

		if complaint != markUserRule {
			t.Errorf("expected %q to refuse it, got %q", markUserRule, complaint)
		}
	})
}

func TestTaskMarks_EveryColumnIsRequired(t *testing.T) {
	for _, column := range requiredMarkColumnCases {
		t.Run(column, func(t *testing.T) {
			scenario := setUpMarkScenario(t)
			values := map[string]any{
				"mark_date":       markDay,
				"hole_feature_id": scenario.holeOneTeeBoxID,
				"task_id":         scenario.teeBoxMowedTaskID,
				"status":          "done",
				"user_id":         scenario.userID,
			}
			values[column] = nil

			code := databaseErrorCode(t, addTaskMark(
				values["mark_date"], values["hole_feature_id"], values["task_id"], values["status"], values["user_id"],
			))

			if code != leftEmptyErrorCode {
				t.Errorf("expected error code %q, got %q", leftEmptyErrorCode, code)
			}
		})
	}
}

func TestTaskMarks_DeletingAHoleDeletesItsMarksAndNoOthers(t *testing.T) {
	scenario := setUpMarkScenario(t)
	mustAddTaskMark(t, markDay, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, markDay, scenario.holeOneBunkerOneID, scenario.bunkerRakedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, markDay, scenario.holeTwoTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)

	mustExec(t, `DELETE FROM holes WHERE id = $1`, scenario.holeOneID)

	if count := countRows(t, `SELECT COUNT(*) FROM task_marks`); count != 1 {
		t.Errorf("expected only the other hole's mark to remain, found %d marks", count)
	}
	if count := marksOnFeature(t, scenario.holeTwoTeeBoxID); count != 1 {
		t.Errorf("the other hole should keep its mark, found %d", count)
	}
}

func TestTaskMarks_DeletingAFeatureDeletesItsMarksAndNoOthers(t *testing.T) {
	scenario := setUpMarkScenario(t)
	mustAddTaskMark(t, markDay, scenario.holeOneBunkerOneID, scenario.bunkerRakedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, markDay, scenario.holeOneBunkerTwoID, scenario.bunkerRakedTaskID, "done", scenario.userID)

	mustExec(t, `DELETE FROM hole_features WHERE id = $1`, scenario.holeOneBunkerTwoID)

	if count := marksOnFeature(t, scenario.holeOneBunkerTwoID); count != 0 {
		t.Errorf("the removed bunker's mark should be gone, found %d", count)
	}
	if count := marksOnFeature(t, scenario.holeOneBunkerOneID); count != 1 {
		t.Errorf("the other bunker should keep its mark, found %d", count)
	}
}

func TestTaskMarks_DeletingATaskDeletesItsMarksAndNoOthers(t *testing.T) {
	scenario := setUpMarkScenario(t)
	mustAddTaskMark(t, markDay, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, markDay, scenario.holeOneTeeBoxID, scenario.teeBoxClearedTaskID, "done", scenario.userID)

	mustExec(t, `DELETE FROM hole_tasks WHERE id = $1`, scenario.teeBoxMowedTaskID)

	if count := marksForTask(t, scenario.teeBoxMowedTaskID); count != 0 {
		t.Errorf("the removed task's mark should be gone, found %d", count)
	}
	if count := marksForTask(t, scenario.teeBoxClearedTaskID); count != 1 {
		t.Errorf("the other task should keep its mark, found %d", count)
	}
}

func TestTaskMarks_APersonWhoHasMarkedSomethingCannotBeDeleted(t *testing.T) {
	scenario := setUpMarkScenario(t)
	mustAddTaskMark(t, markDay, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)

	complaint := featureComplaint(t, execSQL(`DELETE FROM users WHERE id = $1`, scenario.userID))

	if complaint != markUserRule {
		t.Errorf("expected %q to refuse it, got %q", markUserRule, complaint)
	}
	if count := countRows(t, `SELECT COUNT(*) FROM task_marks`); count != 1 {
		t.Errorf("the mark must still be there, found %d marks", count)
	}
}

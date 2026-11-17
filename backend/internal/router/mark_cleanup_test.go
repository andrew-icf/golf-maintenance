package router_test

import (
	"context"
	"reflect"
	"testing"

	"golf-maintenance/backend/internal/jobs"
)

// How old a mark is and whether it is kept. A mark is kept for 14 days after its day, so one from
// exactly 14 days ago stays and one from 15 days ago goes. These numbers are written out by hand, and
// not read from the code, so that changing how long marks are kept makes a test fail.
var markAgeCases = []struct {
	label   string
	daysOld int
	kept    bool
}{
	{"30 days old", 30, false},
	{"15 days old", 15, false},
	{"14 days old", 14, true},
	{"13 days old", 13, true},
	{"yesterday's", 1, true},
	{"today's", 0, true},
	{"tomorrow's", -1, true},
}

// A club in a time zone a day or more ahead of the other, and one behind. A mark 14 days before the
// day in the zone that is behind is old by the end of the day for the club that is ahead, and is
// still kept for the club that is behind.
var cleanupTimezoneCases = []struct {
	name     string
	timezone string
	deleted  int64
}{
	{"a club ahead of the day the mark is dated by deletes it", farEastTimezone, 1},
	{"a club on the same day as the mark's date keeps it", farWestTimezone, 0},
}

// The tables that must be untouched by a cleanup of marks
var tablesLeftAlone = []string{"users", "hole_tasks", "duties", "hole_features", "holes", "layouts", "courses"}

// Actions
func rowCountsOf(t *testing.T, tables []string) map[string]int {
	t.Helper()
	counts := map[string]int{}
	for _, table := range tables {
		counts[table] = countRows(t, "SELECT COUNT(*) FROM "+table)
	}
	return counts
}

func TestDeleteOldTaskMarks_KeepsMarksForFourteenDays(t *testing.T) {
	scenario := setUpMarkScenario(t)
	dates := map[int]string{}
	var expectedDeleted int64
	for _, testCase := range markAgeCases {
		dates[testCase.daysOld] = clubDate(t, -testCase.daysOld)
		mustAddTaskMark(t, dates[testCase.daysOld], scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)
		if !testCase.kept {
			expectedDeleted++
		}
	}

	deleted, err := jobs.DeleteOldTaskMarks(context.Background())

	if err != nil {
		t.Fatalf("could not delete old marks: %v", err)
	}
	if deleted != expectedDeleted {
		t.Errorf("expected %d marks to be deleted, got %d", expectedDeleted, deleted)
	}
	for _, testCase := range markAgeCases {
		t.Run(testCase.label, func(t *testing.T) {
			remaining := countRows(t, `SELECT COUNT(*) FROM task_marks WHERE mark_date = $1::text::date`, dates[testCase.daysOld])

			expected := 0
			if testCase.kept {
				expected = 1
			}
			if remaining != expected {
				t.Errorf("expected %d marks to remain for a mark that is %s, found %d", expected, testCase.label, remaining)
			}
		})
	}
}

func TestDeleteOldTaskMarks_CleansUpMarksOnEveryHoleAndFeature(t *testing.T) {
	scenario := setUpMarkScenario(t)
	today := clubDate(t, 0)
	old := clubDate(t, -20)
	mustAddTaskMark(t, old, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, old, scenario.holeTwoTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, old, scenario.holeOneBunkerOneID, scenario.bunkerRakedTaskID, "not_today", scenario.userID)
	mustAddTaskMark(t, today, scenario.holeTwoTeeBoxID, scenario.teeBoxClearedTaskID, "done", scenario.userID)

	deleted, err := jobs.DeleteOldTaskMarks(context.Background())

	if err != nil {
		t.Fatalf("could not delete old marks: %v", err)
	}
	if deleted != 3 {
		t.Errorf("expected 3 marks to be deleted, got %d", deleted)
	}
	expected := []storedMark{
		{today, scenario.holeTwoTeeBoxID, scenario.teeBoxClearedTaskID, "done", scenario.userID},
	}
	if actual := loadTaskMarks(t); !reflect.DeepEqual(actual, expected) {
		t.Errorf("expected only today's mark to remain, got %+v", actual)
	}
}

func TestDeleteOldTaskMarks_DeletesBothStatuses(t *testing.T) {
	scenario := setUpMarkScenario(t)
	old := clubDate(t, -20)
	mustAddTaskMark(t, old, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, old, scenario.holeOneTeeBoxID, scenario.teeBoxClearedTaskID, "not_today", scenario.userID)

	deleted, err := jobs.DeleteOldTaskMarks(context.Background())

	if err != nil {
		t.Fatalf("could not delete old marks: %v", err)
	}
	if deleted != 2 {
		t.Errorf("expected 2 marks to be deleted, got %d", deleted)
	}
	if remaining := len(loadTaskMarks(t)); remaining != 0 {
		t.Errorf("expected no marks to remain, found %d", remaining)
	}
}

func TestDeleteOldTaskMarks_LeavesEverythingElseAlone(t *testing.T) {
	scenario := setUpMarkScenario(t)
	mustAddTaskMark(t, clubDate(t, -20), scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)
	before := rowCountsOf(t, tablesLeftAlone)

	deleted, err := jobs.DeleteOldTaskMarks(context.Background())

	if err != nil {
		t.Fatalf("could not delete old marks: %v", err)
	}
	if deleted != 1 {
		t.Fatalf("expected the old mark to be deleted, got %d", deleted)
	}
	if after := rowCountsOf(t, tablesLeftAlone); !reflect.DeepEqual(after, before) {
		t.Errorf("a cleanup of marks changed other tables: %v became %v", before, after)
	}
}

func TestDeleteOldTaskMarks_DoesNothingWhenNothingIsOld(t *testing.T) {
	scenario := setUpMarkScenario(t)
	mustAddTaskMark(t, clubDate(t, 0), scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, clubDate(t, -1), scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)

	deleted, err := jobs.DeleteOldTaskMarks(context.Background())

	if err != nil {
		t.Fatalf("could not delete old marks: %v", err)
	}
	if deleted != 0 {
		t.Errorf("expected nothing to be deleted, got %d", deleted)
	}
	if remaining := len(loadTaskMarks(t)); remaining != 2 {
		t.Errorf("expected both marks to remain, found %d", remaining)
	}
}

func TestDeleteOldTaskMarks_FollowsTheClubsOwnTimezone(t *testing.T) {
	for _, testCase := range cleanupTimezoneCases {
		t.Run(testCase.name, func(t *testing.T) {
			scenario := setUpMarkScenario(t)
			mustExec(t, `UPDATE courses SET timezone = $1`, testCase.timezone)
			markDate := lookupText(t, `SELECT ((now() AT TIME ZONE $1::text)::date - 14)::text`, farWestTimezone)
			mustAddTaskMark(t, markDate, scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)

			deleted, err := jobs.DeleteOldTaskMarks(context.Background())

			if err != nil {
				t.Fatalf("could not delete old marks: %v", err)
			}
			if deleted != testCase.deleted {
				t.Errorf("expected %d marks to be deleted, got %d", testCase.deleted, deleted)
			}
		})
	}
}

func TestDeleteOldTaskMarks_RunningAgainDeletesNothingMore(t *testing.T) {
	scenario := setUpMarkScenario(t)
	mustAddTaskMark(t, clubDate(t, -20), scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)

	first, firstErr := jobs.DeleteOldTaskMarks(context.Background())
	second, secondErr := jobs.DeleteOldTaskMarks(context.Background())

	if firstErr != nil || secondErr != nil {
		t.Fatalf("could not delete old marks: %v, %v", firstErr, secondErr)
	}
	if first != 1 || second != 0 {
		t.Errorf("expected 1 then 0 marks to be deleted, got %d then %d", first, second)
	}
}

func TestDeleteOldTaskMarks_WorksWhenThereAreNoMarksAtAll(t *testing.T) {
	setUpMarkScenario(t)

	deleted, err := jobs.DeleteOldTaskMarks(context.Background())

	if err != nil {
		t.Fatalf("could not delete old marks: %v", err)
	}
	if deleted != 0 {
		t.Errorf("expected nothing to be deleted, got %d", deleted)
	}
}

func TestCleanUpOldMarks_DeletesTheOldMarksAndKeepsTheRest(t *testing.T) {
	scenario := setUpMarkScenario(t)
	today := clubDate(t, 0)
	mustAddTaskMark(t, clubDate(t, -20), scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)
	mustAddTaskMark(t, today, scenario.holeOneTeeBoxID, scenario.teeBoxClearedTaskID, "done", scenario.userID)

	jobs.CleanUpOldMarks(context.Background())

	marks := loadTaskMarks(t)
	if len(marks) != 1 || marks[0].Date != today {
		t.Errorf("expected only today's mark to remain, got %+v", marks)
	}
}

func TestCleanUpOldMarks_ACancelledContextLeavesTheMarksAndDoesNotPanic(t *testing.T) {
	scenario := setUpMarkScenario(t)
	mustAddTaskMark(t, clubDate(t, -20), scenario.holeOneTeeBoxID, scenario.teeBoxMowedTaskID, "done", scenario.userID)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	jobs.CleanUpOldMarks(ctx)

	if remaining := len(loadTaskMarks(t)); remaining != 1 {
		t.Errorf("expected the mark to remain when the cleanup could not run, found %d", remaining)
	}
}

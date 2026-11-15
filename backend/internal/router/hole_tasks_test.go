package router_test

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/testutil"
)

// The names of the rules in the migration, so a test can tell which one refused something, and the
// error codes Postgres gives for a column left empty and for a value that is not in an enum
const (
	dutyCodeRule       = "duties_code_key"
	dutyNameRule       = "duties_name_not_blank"
	dutyPositionRule   = "duties_position_positive"
	taskCodeRule       = "hole_tasks_code_key"
	taskNameRule       = "hole_tasks_name_not_blank"
	taskPositionRule   = "hole_tasks_position_positive"
	taskDutyRule       = "hole_tasks_duty_id_fkey"
	leftEmptyErrorCode = "23502"
	notInEnumErrorCode = "22P02"
)

type storedDuty struct {
	Code     string
	Name     string
	Position int
}

// JobTitles is the list of titles as one comma-separated string, in the order stored
type storedTask struct {
	Code        string
	FeatureType string
	Name        string
	JobTitles   string
	DutyCode    string
	Position    int
}

// The default list, written out by hand so the seed file is checked against it
var expectedDefaultDuties = []storedDuty{
	{"greenskeeper", "Greenskeeper tasks", 1},
	{"bunkers", "Bunkers", 2},
	{"greens", "Greens", 3},
	{"rolling", "Rolling", 4},
	{"spraying", "Spraying", 5},
	{"rough", "Rough", 6},
	{"tees_and_fairways", "Tees and fairways", 7},
}

var expectedDefaultTasks = []storedTask{
	{"tee-box-cleared", "tee_box", "Cleared", "greenskeeper", "greenskeeper", 1},
	{"collect-garbage", "tee_box", "Collect garbage", "greenskeeper", "greenskeeper", 2},
	{"tee-box-mowed", "tee_box", "Mowed", "operator", "tees_and_fairways", 3},
	{"par-3-tee-box-cleared", "par_3_tee_box", "Cleared", "greenskeeper", "greenskeeper", 4},
	{"par-3-tee-box-mowed", "par_3_tee_box", "Mowed", "operator", "tees_and_fairways", 5},
	{"fairway-mowed", "fairway", "Fairway mowed", "operator", "tees_and_fairways", 6},
	{"cart-signs", "fairway", "Cart signs", "greenskeeper", "greenskeeper", 7},
	{"fairway-sprayed", "fairway", "Fairway sprayed", "operator", "spraying", 8},
	{"rough-mowed", "rough", "Rough mowed", "operator", "rough", 9},
	{"bunker-raked-machine", "bunker", "Raked by machine", "operator", "bunkers", 10},
	{"bunker-raked-hand", "bunker", "Raked by hand", "greenskeeper", "greenskeeper", 11},
	{"pin-placement", "green", "Pin placement", "greenskeeper", "greenskeeper", 12},
	{"ball-marks", "green", "Ball marks", "greenskeeper", "greenskeeper", 13},
	{"top-dress", "green", "Top dress", "greenskeeper", "greenskeeper", 14},
	{"green-mowed", "green", "Mowed", "operator", "greens", 15},
	{"green-rolled", "green", "Rolled", "operator", "rolling", 16},
	{"green-sprayed", "green", "Sprayed", "operator", "spraying", 17},
}

// A name must hold something besides whitespace, and a position starts at 1
var refusedDutyCases = []struct {
	name     string
	dutyName string
	position int
	expected string
}{
	{"a blank name", "", 1, dutyNameRule},
	{"a name of only spaces", "   ", 1, dutyNameRule},
	{"a name of only a tab and a line break", "\t\n", 1, dutyNameRule},
	{"a position of zero", "Greens", 0, dutyPositionRule},
	{"a negative position", "Greens", -1, dutyPositionRule},
}

var refusedTaskCases = []struct {
	name     string
	taskName string
	position int
	expected string
}{
	{"a blank name", "", 1, taskNameRule},
	{"a name of only spaces", "   ", 1, taskNameRule},
	{"a name of only a tab and a line break", "\t\n", 1, taskNameRule},
	{"a position of zero", "Mowed", 0, taskPositionRule},
	{"a negative position", "Mowed", -1, taskPositionRule},
}

// Lists of job titles that are not all real titles
var refusedJobTitleCases = []struct {
	name      string
	jobTitles string
}{
	{"a title that does not exist", "{janitor}"},
	{"a real title next to one that does not exist", "{greenskeeper,janitor}"},
	{"the retired title gardener", "{gardener}"},
}

// Actions
func addDuty(code, name string, position int) error {
	return execSQL(`INSERT INTO duties (code, name, position) VALUES ($1, $2, $3)`, code, name, position)
}

func mustAddDuty(t *testing.T, code, name string, position int) string {
	t.Helper()
	return insertedID(t,
		`INSERT INTO duties (code, name, position) VALUES ($1, $2, $3) RETURNING id`,
		code, name, position,
	)
}

// jobTitles is written the way Postgres writes a list, such as "{greenskeeper,operator}". dutyID is
// left open so a test can pass nil for a task with no duty.
func addHoleTask(code, featureType, name, jobTitles string, dutyID any, position int) error {
	return execSQL(
		`INSERT INTO hole_tasks (code, feature_type, name, allowed_job_titles, duty_id, position)
		 VALUES ($1, $2, $3, $4::job_title_type[], $5, $6)`,
		code, featureType, name, jobTitles, dutyID, position,
	)
}

func mustAddHoleTask(t *testing.T, code, featureType, name, jobTitles string, dutyID any, position int) {
	t.Helper()
	if err := addHoleTask(code, featureType, name, jobTitles, dutyID, position); err != nil {
		t.Fatalf("could not add the task %s: %v", code, err)
	}
}

// The error code Postgres gave. It fails the test when nothing went wrong, since every use of it
// is meant to be refused.
func databaseErrorCode(t *testing.T, err error) string {
	t.Helper()
	if err == nil {
		t.Fatal("expected the database to refuse this, but it was accepted")
	}

	var databaseError *pgconn.PgError
	if !errors.As(err, &databaseError) {
		t.Fatalf("expected a database error, got %v", err)
	}
	return databaseError.Code
}

// Runs the default list the way the seed file is run by hand
func runDefaultTasksSeed(t *testing.T) {
	t.Helper()
	seed, err := os.ReadFile(filepath.Join("..", "..", "seed", "default_tasks.sql"))
	if err != nil {
		t.Fatalf("could not read the seed file: %v", err)
	}
	if _, err := db.Pool.Exec(context.Background(), string(seed)); err != nil {
		t.Fatalf("could not run the seed file: %v", err)
	}
}

func loadDuties(t *testing.T) []storedDuty {
	t.Helper()
	rows, err := db.Pool.Query(context.Background(), `SELECT code, name, position FROM duties ORDER BY position`)
	if err != nil {
		t.Fatalf("could not read duties: %v", err)
	}
	defer rows.Close()

	duties := []storedDuty{}
	for rows.Next() {
		var duty storedDuty
		if err := rows.Scan(&duty.Code, &duty.Name, &duty.Position); err != nil {
			t.Fatalf("could not read a duty: %v", err)
		}
		duties = append(duties, duty)
	}
	return duties
}

func loadHoleTasks(t *testing.T) []storedTask {
	t.Helper()
	rows, err := db.Pool.Query(
		context.Background(),
		`SELECT hole_tasks.code, hole_tasks.feature_type::text, hole_tasks.name,
		        array_to_string(hole_tasks.allowed_job_titles, ','), duties.code, hole_tasks.position
		 FROM hole_tasks
		 JOIN duties ON duties.id = hole_tasks.duty_id
		 ORDER BY hole_tasks.position`,
	)
	if err != nil {
		t.Fatalf("could not read tasks: %v", err)
	}
	defer rows.Close()

	tasks := []storedTask{}
	for rows.Next() {
		var task storedTask
		if err := rows.Scan(&task.Code, &task.FeatureType, &task.Name, &task.JobTitles, &task.DutyCode, &task.Position); err != nil {
			t.Fatalf("could not read a task: %v", err)
		}
		tasks = append(tasks, task)
	}
	return tasks
}

// Every row's id, by its code, to show that a rerun changes nothing about the rows that were there
func idsByCode(t *testing.T, table string) map[string]string {
	t.Helper()
	rows, err := db.Pool.Query(context.Background(), fmt.Sprintf(`SELECT code, id::text FROM %s`, table))
	if err != nil {
		t.Fatalf("could not read %s: %v", table, err)
	}
	defer rows.Close()

	ids := map[string]string{}
	for rows.Next() {
		var code, id string
		if err := rows.Scan(&code, &id); err != nil {
			t.Fatalf("could not read a row of %s: %v", table, err)
		}
		ids[code] = id
	}
	return ids
}

func TestDuties_ACodeCanOnlyBeUsedOnce(t *testing.T) {
	testutil.SetupTestDB(t)
	mustAddDuty(t, "greens", "Greens", 1)

	complaint := featureComplaint(t, addDuty("greens", "Greens again", 2))

	if complaint != dutyCodeRule {
		t.Errorf("expected %q to refuse it, got %q", dutyCodeRule, complaint)
	}
	if count := countRows(t, `SELECT COUNT(*) FROM duties`); count != 1 {
		t.Errorf("a refused duty must not be added, found %d duties", count)
	}
}

func TestDuties_RefuseABlankNameOrAPositionBelowOne(t *testing.T) {
	testutil.SetupTestDB(t)

	for _, testCase := range refusedDutyCases {
		t.Run(testCase.name, func(t *testing.T) {
			complaint := featureComplaint(t, addDuty("greens", testCase.dutyName, testCase.position))

			if complaint != testCase.expected {
				t.Errorf("expected %q to refuse it, got %q", testCase.expected, complaint)
			}
		})
	}
}

func TestHoleTasks_ACodeCanOnlyBeUsedOnce(t *testing.T) {
	testutil.SetupTestDB(t)
	dutyID := mustAddDuty(t, "greens", "Greens", 1)
	mustAddHoleTask(t, "green-mowed", "green", "Mowed", "{operator}", dutyID, 1)

	complaint := featureComplaint(t, addHoleTask("green-mowed", "green", "Mowed again", "{operator}", dutyID, 2))

	if complaint != taskCodeRule {
		t.Errorf("expected %q to refuse it, got %q", taskCodeRule, complaint)
	}
	if count := countRows(t, `SELECT COUNT(*) FROM hole_tasks`); count != 1 {
		t.Errorf("a refused task must not be added, found %d tasks", count)
	}
}

func TestHoleTasks_RefuseABlankNameOrAPositionBelowOne(t *testing.T) {
	testutil.SetupTestDB(t)
	dutyID := mustAddDuty(t, "greens", "Greens", 1)

	for _, testCase := range refusedTaskCases {
		t.Run(testCase.name, func(t *testing.T) {
			complaint := featureComplaint(t, addHoleTask("green-mowed", "green", testCase.taskName, "{operator}", dutyID, testCase.position))

			if complaint != testCase.expected {
				t.Errorf("expected %q to refuse it, got %q", testCase.expected, complaint)
			}
		})
	}
}

func TestHoleTasks_NeedARealDuty(t *testing.T) {
	testutil.SetupTestDB(t)

	t.Run("a duty that does not exist", func(t *testing.T) {
		complaint := featureComplaint(t, addHoleTask("green-mowed", "green", "Mowed", "{operator}", nonexistentID, 1))

		if complaint != taskDutyRule {
			t.Errorf("expected %q to refuse it, got %q", taskDutyRule, complaint)
		}
	})

	t.Run("no duty at all", func(t *testing.T) {
		code := databaseErrorCode(t, addHoleTask("green-mowed", "green", "Mowed", "{operator}", nil, 1))

		if code != leftEmptyErrorCode {
			t.Errorf("expected error code %q, got %q", leftEmptyErrorCode, code)
		}
	})
}

func TestHoleTasks_NeedARealFeatureType(t *testing.T) {
	testutil.SetupTestDB(t)
	dutyID := mustAddDuty(t, "greens", "Greens", 1)

	code := databaseErrorCode(t, addHoleTask("dugout-swept", "dugout", "Swept", "{operator}", dutyID, 1))

	if code != notInEnumErrorCode {
		t.Errorf("expected error code %q, got %q", notInEnumErrorCode, code)
	}
}

func TestHoleTasks_JobTitlesMustBeRealTitles(t *testing.T) {
	testutil.SetupTestDB(t)
	dutyID := mustAddDuty(t, "greens", "Greens", 1)

	for _, testCase := range refusedJobTitleCases {
		t.Run(testCase.name, func(t *testing.T) {
			code := databaseErrorCode(t, addHoleTask("green-mowed", "green", "Mowed", testCase.jobTitles, dutyID, 1))

			if code != notInEnumErrorCode {
				t.Errorf("expected error code %q, got %q", notInEnumErrorCode, code)
			}
		})
	}
}

func TestHoleTasks_AnEmptyListOfJobTitlesIsAllowedAndMeansOnlyAdminsMayCheckIt(t *testing.T) {
	testutil.SetupTestDB(t)
	dutyID := mustAddDuty(t, "greens", "Greens", 1)

	mustAddHoleTask(t, "green-inspected", "green", "Inspected", "{}", dutyID, 1)

	tasks := loadHoleTasks(t)
	if len(tasks) != 1 || tasks[0].JobTitles != "" {
		t.Errorf("expected one task with no job titles, got %+v", tasks)
	}
}

func TestHoleTasks_ATaskCanNameSeveralJobTitles(t *testing.T) {
	testutil.SetupTestDB(t)
	dutyID := mustAddDuty(t, "greens", "Greens", 1)

	mustAddHoleTask(t, "green-checked", "green", "Checked", "{greenskeeper,operator}", dutyID, 1)

	tasks := loadHoleTasks(t)
	if len(tasks) != 1 || tasks[0].JobTitles != "greenskeeper,operator" {
		t.Errorf("expected one task for greenskeepers and operators, got %+v", tasks)
	}
}

func TestDuties_OnlyADutyNoTaskUsesCanBeDeleted(t *testing.T) {
	testutil.SetupTestDB(t)
	usedID := mustAddDuty(t, "greens", "Greens", 1)
	unusedID := mustAddDuty(t, "rolling", "Rolling", 2)
	mustAddHoleTask(t, "green-mowed", "green", "Mowed", "{operator}", usedID, 1)

	complaint := featureComplaint(t, execSQL(`DELETE FROM duties WHERE id = $1`, usedID))
	if complaint != taskDutyRule {
		t.Errorf("expected %q to refuse deleting a duty tasks use, got %q", taskDutyRule, complaint)
	}

	mustExec(t, `DELETE FROM duties WHERE id = $1`, unusedID)

	if count := countRows(t, `SELECT COUNT(*) FROM duties`); count != 1 {
		t.Errorf("expected only the duty in use to remain, found %d duties", count)
	}
	if count := countRows(t, `SELECT COUNT(*) FROM hole_tasks`); count != 1 {
		t.Errorf("the task must still be there, found %d tasks", count)
	}
}

func TestSetupTestDB_ClearsDutiesAndHoleTasks(t *testing.T) {
	testutil.SetupTestDB(t)
	dutyID := mustAddDuty(t, "greens", "Greens", 1)
	mustAddHoleTask(t, "green-mowed", "green", "Mowed", "{operator}", dutyID, 1)

	testutil.SetupTestDB(t)

	if count := countRows(t, `SELECT COUNT(*) FROM duties`); count != 0 {
		t.Errorf("the test wipe should clear duties, found %d", count)
	}
	if count := countRows(t, `SELECT COUNT(*) FROM hole_tasks`); count != 0 {
		t.Errorf("the test wipe should clear tasks, found %d", count)
	}
}

func TestDefaultTasksSeed_CreatesTheSevenDutiesInOrder(t *testing.T) {
	testutil.SetupTestDB(t)

	runDefaultTasksSeed(t)

	if actual := loadDuties(t); !reflect.DeepEqual(actual, expectedDefaultDuties) {
		t.Errorf("expected %+v, got %+v", expectedDefaultDuties, actual)
	}
}

func TestDefaultTasksSeed_CreatesTheSeventeenTasksInOrder(t *testing.T) {
	testutil.SetupTestDB(t)

	runDefaultTasksSeed(t)

	if actual := loadHoleTasks(t); !reflect.DeepEqual(actual, expectedDefaultTasks) {
		t.Errorf("expected %+v, got %+v", expectedDefaultTasks, actual)
	}
}

func TestDefaultTasksSeed_GivesTheApproachNoTasks(t *testing.T) {
	testutil.SetupTestDB(t)

	runDefaultTasksSeed(t)

	count := countRows(t, `SELECT COUNT(*) FROM hole_tasks WHERE feature_type = 'approach'`)
	if count != 0 {
		t.Errorf("the approach has no tasks yet, found %d", count)
	}
}

func TestDefaultTasksSeed_CanBeRunAgainWithoutChangingAnything(t *testing.T) {
	testutil.SetupTestDB(t)
	runDefaultTasksSeed(t)
	dutyIDs := idsByCode(t, "duties")
	taskIDs := idsByCode(t, "hole_tasks")

	runDefaultTasksSeed(t)

	if actual := idsByCode(t, "duties"); !reflect.DeepEqual(actual, dutyIDs) {
		t.Errorf("a rerun changed the duties' ids or their number")
	}
	if actual := idsByCode(t, "hole_tasks"); !reflect.DeepEqual(actual, taskIDs) {
		t.Errorf("a rerun changed the tasks' ids or their number")
	}
	if actual := loadHoleTasks(t); !reflect.DeepEqual(actual, expectedDefaultTasks) {
		t.Errorf("a rerun changed the tasks: %+v", actual)
	}
}

func TestDefaultTasksSeed_PutsAnEditedTaskBackAndLeavesOtherTasksAlone(t *testing.T) {
	testutil.SetupTestDB(t)
	runDefaultTasksSeed(t)
	mustExec(t, `UPDATE hole_tasks SET name = 'Edited by someone' WHERE code = 'green-mowed'`)
	laterDutyID := mustAddDuty(t, "added-later", "A duty added later", 8)
	mustAddHoleTask(t, "added-later", "green", "A task added later", "{landscaper}", laterDutyID, 18)

	runDefaultTasksSeed(t)

	var name string
	err := db.Pool.QueryRow(context.Background(), `SELECT name FROM hole_tasks WHERE code = 'green-mowed'`).Scan(&name)
	if err != nil {
		t.Fatalf("could not read the task: %v", err)
	}
	if name != "Mowed" {
		t.Errorf("expected the seed to put the name back to Mowed, got %q", name)
	}
	if count := countRows(t, `SELECT COUNT(*) FROM hole_tasks`); count != 18 {
		t.Errorf("the task added later should still be there, found %d tasks", count)
	}
	if count := countRows(t, `SELECT COUNT(*) FROM duties`); count != 8 {
		t.Errorf("the duty added later should still be there, found %d duties", count)
	}
}

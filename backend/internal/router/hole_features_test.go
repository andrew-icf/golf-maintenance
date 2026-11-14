package router_test

import (
	"context"
	"errors"
	"reflect"
	"sort"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/models"
	"golf-maintenance/backend/internal/testutil"
)

// The names of the rules in the migration, so a test can tell which one refused something, and the
// error code Postgres gives for a value that is not in an enum
const (
	duplicateFeatureRule     = "hole_features_unique_position"
	positionPositiveRule     = "hole_features_position_positive"
	oneUnlessBunkerRule      = "hole_features_one_unless_bunker"
	realHoleRule             = "hole_features_hole_id_fkey"
	notAFeatureTypeErrorCode = "22P02"
)

// Features that were put on a hole that already has the standard six, and what should refuse them
var refusedPositionCases = []struct {
	name        string
	featureType string
	position    int
	expected    string
}{
	{"a second tee box", "tee_box", 2, oneUnlessBunkerRule},
	{"a second par 3 tee box", "par_3_tee_box", 2, oneUnlessBunkerRule},
	{"a second fairway", "fairway", 2, oneUnlessBunkerRule},
	{"a second approach", "approach", 2, oneUnlessBunkerRule},
	{"a second rough", "rough", 2, oneUnlessBunkerRule},
	{"a second green", "green", 2, oneUnlessBunkerRule},
	{"a bunker at position zero", "bunker", 0, positionPositiveRule},
	{"a bunker at a negative position", "bunker", -1, positionPositiveRule},
}

// Actions
func addHoleFeature(holeID, featureType string, position int) error {
	return execSQL(
		`INSERT INTO hole_features (hole_id, feature_type, position) VALUES ($1, $2, $3)`,
		holeID, featureType, position,
	)
}

func mustAddHoleFeature(t *testing.T, holeID, featureType string, position int) {
	t.Helper()
	if err := addHoleFeature(holeID, featureType, position); err != nil {
		t.Fatalf("could not add %s %d: %v", featureType, position, err)
	}
}

// What Postgres says went wrong: the name of the rule that was broken, or the error code when the
// rule has no name, such as a value that is not in an enum. It fails the test when nothing went
// wrong, since every use of it is meant to be refused.
func featureComplaint(t *testing.T, err error) string {
	t.Helper()
	if err == nil {
		t.Fatal("expected the database to refuse this, but it was accepted")
	}

	var databaseError *pgconn.PgError
	if !errors.As(err, &databaseError) {
		t.Fatalf("expected a database error, got %v", err)
	}
	if databaseError.ConstraintName != "" {
		return databaseError.ConstraintName
	}
	return databaseError.Code
}

func featureCount(t *testing.T, holeID string) int {
	t.Helper()
	return countRows(t, `SELECT COUNT(*) FROM hole_features WHERE hole_id = $1`, holeID)
}

func featureTypesOf(t *testing.T, holeID string) []string {
	t.Helper()
	rows, err := db.Pool.Query(
		context.Background(),
		`SELECT feature_type::text FROM hole_features WHERE hole_id = $1 ORDER BY feature_type, position`,
		holeID,
	)
	if err != nil {
		t.Fatalf("could not read features: %v", err)
	}
	defer rows.Close()

	featureTypes := []string{}
	for rows.Next() {
		var featureType string
		if err := rows.Scan(&featureType); err != nil {
			t.Fatalf("could not read a feature: %v", err)
		}
		featureTypes = append(featureTypes, featureType)
	}
	return featureTypes
}

func sortedFeatureTypes(featureTypes []string) []string {
	sorted := append([]string(nil), featureTypes...)
	sort.Strings(sorted)
	return sorted
}

func TestHoleFeatures_EveryNewHoleGetsTheStandardSix(t *testing.T) {
	testutil.SetupTestDB(t)
	club := buildClub(t, []int{9, 9})
	expected := sortedFeatureTypes(models.StandardHoleFeatureTypes())

	for courseIndex, holeIDs := range club.HoleIDs {
		for holeIndex, holeID := range holeIDs {
			actual := sortedFeatureTypes(featureTypesOf(t, holeID))

			if !reflect.DeepEqual(actual, expected) {
				t.Errorf("course %d, hole %d: expected %v, got %v", courseIndex, holeIndex+1, expected, actual)
			}
		}
	}
}

func TestHoleFeatures_ANewHoleHasNoBunkers(t *testing.T) {
	testutil.SetupTestDB(t)
	club := buildClub(t, []int{3})

	for _, holeID := range club.HoleIDs[0] {
		count := countRows(t, `SELECT COUNT(*) FROM hole_features WHERE hole_id = $1 AND feature_type = 'bunker'`, holeID)

		if count != 0 {
			t.Errorf("a new hole should have no bunkers, found %d", count)
		}
	}
}

func TestHoleFeatures_ASecondFeatureOfTheSameKindAndPositionIsRefused(t *testing.T) {
	testutil.SetupTestDB(t)
	holeID := buildClub(t, []int{1}).HoleIDs[0][0]

	complaint := featureComplaint(t, addHoleFeature(holeID, "fairway", 1))

	if complaint != duplicateFeatureRule {
		t.Errorf("expected %q to refuse it, got %q", duplicateFeatureRule, complaint)
	}
	if count := featureCount(t, holeID); count != 6 {
		t.Errorf("a refused feature must not be added, found %d features", count)
	}
}

func TestHoleFeatures_OnlyBunkersMayHaveMoreThanOnePositionAndPositionsStartAtOne(t *testing.T) {
	testutil.SetupTestDB(t)
	holeID := buildClub(t, []int{1}).HoleIDs[0][0]

	for _, testCase := range refusedPositionCases {
		t.Run(testCase.name, func(t *testing.T) {
			complaint := featureComplaint(t, addHoleFeature(holeID, testCase.featureType, testCase.position))

			if complaint != testCase.expected {
				t.Errorf("expected %q to refuse it, got %q", testCase.expected, complaint)
			}
		})
	}
}

func TestHoleFeatures_BunkersAreNumberedFromOneAndEachNumberIsUsedOnce(t *testing.T) {
	testutil.SetupTestDB(t)
	holeID := buildClub(t, []int{1}).HoleIDs[0][0]
	for position := 1; position <= 3; position++ {
		mustAddHoleFeature(t, holeID, "bunker", position)
	}

	complaint := featureComplaint(t, addHoleFeature(holeID, "bunker", 2))

	if complaint != duplicateFeatureRule {
		t.Errorf("expected %q to refuse a second bunker 2, got %q", duplicateFeatureRule, complaint)
	}
	bunkers := countRows(t, `SELECT COUNT(*) FROM hole_features WHERE hole_id = $1 AND feature_type = 'bunker'`, holeID)
	if bunkers != 3 {
		t.Errorf("expected 3 bunkers, found %d", bunkers)
	}
}

func TestHoleFeatures_AFeatureTypeThatDoesNotExistIsRefused(t *testing.T) {
	testutil.SetupTestDB(t)
	holeID := buildClub(t, []int{1}).HoleIDs[0][0]

	complaint := featureComplaint(t, addHoleFeature(holeID, "dugout", 1))

	if complaint != notAFeatureTypeErrorCode {
		t.Errorf("expected error code %q, got %q", notAFeatureTypeErrorCode, complaint)
	}
}

func TestHoleFeatures_AFeatureNeedsAHoleThatExists(t *testing.T) {
	testutil.SetupTestDB(t)

	complaint := featureComplaint(t, addHoleFeature(nonexistentID, "fairway", 1))

	if complaint != realHoleRule {
		t.Errorf("expected %q to refuse it, got %q", realHoleRule, complaint)
	}
}

func TestHoleFeatures_DeletingAHoleDeletesItsFeaturesAndNoOthers(t *testing.T) {
	testutil.SetupTestDB(t)
	holeIDs := buildClub(t, []int{3}).HoleIDs[0]
	mustAddHoleFeature(t, holeIDs[0], "bunker", 1)
	mustAddHoleFeature(t, holeIDs[0], "bunker", 2)

	mustExec(t, `DELETE FROM holes WHERE id = $1`, holeIDs[0])

	if count := featureCount(t, holeIDs[0]); count != 0 {
		t.Errorf("the deleted hole's features should be gone, found %d", count)
	}
	for _, otherHoleID := range holeIDs[1:] {
		if count := featureCount(t, otherHoleID); count != 6 {
			t.Errorf("another hole should keep its 6 features, found %d", count)
		}
	}
}

func TestHoleFeatures_DeletingACourseDeletesTheFeaturesOfItsHolesAndNoOthers(t *testing.T) {
	testutil.SetupTestDB(t)
	club := buildClub(t, []int{3, 3})

	mustExec(t, `DELETE FROM layouts WHERE id = $1`, club.LayoutIDs[0])

	for _, holeID := range club.HoleIDs[0] {
		if count := featureCount(t, holeID); count != 0 {
			t.Errorf("a hole on the deleted course should have no features left, found %d", count)
		}
	}
	for _, holeID := range club.HoleIDs[1] {
		if count := featureCount(t, holeID); count != 6 {
			t.Errorf("a hole on the other course should keep its 6 features, found %d", count)
		}
	}
}

func TestHoleFeatureTypes_GoListMatchesDatabaseEnum(t *testing.T) {
	testutil.SetupTestDB(t)

	rows, err := db.Pool.Query(
		context.Background(),
		`SELECT unnest(enum_range(NULL::hole_feature_type))::text`,
	)
	if err != nil {
		t.Fatalf("could not read enum values: %v", err)
	}
	defer rows.Close()

	databaseTypes := []string{}
	for rows.Next() {
		var featureType string
		if err := rows.Scan(&featureType); err != nil {
			t.Fatalf("could not read an enum value: %v", err)
		}
		databaseTypes = append(databaseTypes, featureType)
	}

	if goTypes := models.HoleFeatureTypes(); !reflect.DeepEqual(databaseTypes, goTypes) {
		t.Errorf("database enum and Go list have drifted apart.\ndatabase: %v\ngo list:  %v", databaseTypes, goTypes)
	}
}

func TestStandardHoleFeatureTypes_AreEveryTypeExceptBunker(t *testing.T) {
	expected := []string{}
	for _, featureType := range models.HoleFeatureTypes() {
		if featureType != "bunker" {
			expected = append(expected, featureType)
		}
	}

	if actual := models.StandardHoleFeatureTypes(); !reflect.DeepEqual(actual, expected) {
		t.Errorf("expected %v, got %v", expected, actual)
	}
}

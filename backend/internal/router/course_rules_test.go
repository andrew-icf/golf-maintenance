package router_test

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"golf-maintenance/backend/internal/testutil"
)

// Postgres error codes for the four kinds of refusal these rules produce
const (
	uniqueViolation     = "23505"
	checkViolation      = "23514"
	notNullViolation    = "23502"
	foreignKeyViolation = "23503"
)

// Actions
func tryInsertLayout(courseID, name string, code *string, position int, frontHoleCount *int) error {
	return execSQL(
		`INSERT INTO layouts (course_id, name, code, position, front_hole_count)
		 VALUES ($1, $2, $3, $4, $5)`,
		courseID, name, code, position, frontHoleCount,
	)
}

func tryInsertHole(layoutID string, holeNumber int) error {
	return execSQL(
		`INSERT INTO holes (layout_id, hole_number, par) VALUES ($1, $2, 4)`,
		layoutID, holeNumber,
	)
}

func tryInsertAmenity(courseID string, holeID *string) error {
	return execSQL(
		`INSERT INTO amenities (course_id, name, type, hole_id)
		 VALUES ($1, 'Comfort Station', 'comfort_station', $2)`,
		courseID, holeID,
	)
}

func expectPostgresError(t *testing.T, err error, expectedCode string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected the database to refuse this with error %s, but it was accepted", expectedCode)
	}

	var pgError *pgconn.PgError
	if !errors.As(err, &pgError) {
		t.Fatalf("expected a database error, got: %v", err)
	}
	if pgError.Code != expectedCode {
		t.Fatalf("expected error %s, got %s (%s)", expectedCode, pgError.Code, pgError.Message)
	}
}

func expectAccepted(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("expected the database to accept this, got: %v", err)
	}
}

func holesInClub(t *testing.T, courseID string) int {
	t.Helper()
	return countRows(t,
		`SELECT COUNT(*) FROM holes h JOIN layouts l ON l.id = h.layout_id WHERE l.course_id = $1`,
		courseID,
	)
}

func TestCourseRules_LayoutChangesTheDatabaseRefuses(t *testing.T) {
	// A club that already has "Course A", code A, in first place
	testCases := []struct {
		label          string
		name           string
		code           *string
		position       int
		frontHoleCount *int
		expectedCode   string
	}{
		{"a second course with the same name", "Course A", pointerTo("B"), 2, nil, uniqueViolation},
		{"a second course at the same play position", "Course B", pointerTo("B"), 1, nil, uniqueViolation},
		{"a second course with the same code", "Course B", pointerTo("A"), 2, nil, uniqueViolation},
		{"a play position of zero", "Course B", pointerTo("B"), 0, nil, checkViolation},
		{"a negative play position", "Course B", pointerTo("B"), -1, nil, checkViolation},
		{"a front hole count of zero", "Course B", pointerTo("B"), 2, pointerTo(0), checkViolation},
		{"a negative front hole count", "Course B", pointerTo("B"), 2, pointerTo(-3), checkViolation},
	}

	for _, testCase := range testCases {
		t.Run(testCase.label, func(t *testing.T) {
			testutil.SetupTestDB(t)
			courseID := insertCourse(t, testClubName)
			insertLayout(t, courseID, "Course A", pointerTo("A"), 1, nil)

			err := tryInsertLayout(courseID, testCase.name, testCase.code, testCase.position, testCase.frontHoleCount)

			expectPostgresError(t, err, testCase.expectedCode)
		})
	}
}

func TestCourseRules_LayoutChangesTheDatabaseAccepts(t *testing.T) {
	testCases := []struct {
		label          string
		code           *string
		position       int
		frontHoleCount *int
	}{
		{"a normal second course", pointerTo("B"), 2, pointerTo(5)},
		{"a second course with no code", nil, 2, nil},
		{"a front hole count of one", pointerTo("B"), 2, pointerTo(1)},
		{"a play position well down the order", pointerTo("B"), 12, nil},
	}

	for _, testCase := range testCases {
		t.Run(testCase.label, func(t *testing.T) {
			testutil.SetupTestDB(t)
			courseID := insertCourse(t, testClubName)
			insertLayout(t, courseID, "Course A", pointerTo("A"), 1, nil)

			err := tryInsertLayout(courseID, "Course B", testCase.code, testCase.position, testCase.frontHoleCount)

			expectAccepted(t, err)
		})
	}
}

func TestCourseRules_CoursesWithoutCodesMayShareNoCode(t *testing.T) {
	testutil.SetupTestDB(t)
	courseID := insertCourse(t, testClubName)
	insertLayout(t, courseID, "Front Course", nil, 1, nil)

	expectAccepted(t, tryInsertLayout(courseID, "Back Course", nil, 2, nil))
	expectAccepted(t, tryInsertLayout(courseID, "Third Course", nil, 3, nil))
}

func TestCourseRules_AnotherClubMayReuseNamesCodesAndPositions(t *testing.T) {
	testutil.SetupTestDB(t)
	buildClub(t, []int{9, 9, 9})
	otherClubID := insertCourse(t, "Another Club")

	for index := 0; index < 3; index++ {
		code := layoutCode(index)

		expectAccepted(t, tryInsertLayout(otherClubID, "Course "+code, &code, index+1, nil))
	}
}

func TestCourseRules_HoleChangesTheDatabaseRefuses(t *testing.T) {
	// A club with one nine, which already has hole 1
	setUp := func(t *testing.T) string {
		testutil.SetupTestDB(t)
		club := buildClub(t, []int{1})
		return club.LayoutIDs[0]
	}

	t.Run("a hole number that repeats within a course", func(t *testing.T) {
		layoutID := setUp(t)

		expectPostgresError(t, tryInsertHole(layoutID, 1), uniqueViolation)
	})

	t.Run("a hole number of zero", func(t *testing.T) {
		layoutID := setUp(t)

		expectPostgresError(t, tryInsertHole(layoutID, 0), checkViolation)
	})

	t.Run("a negative hole number", func(t *testing.T) {
		layoutID := setUp(t)

		expectPostgresError(t, tryInsertHole(layoutID, -2), checkViolation)
	})

	t.Run("a hole in a course that doesn't exist", func(t *testing.T) {
		setUp(t)

		expectPostgresError(t, tryInsertHole(nonexistentID, 1), foreignKeyViolation)
	})

	t.Run("a hole in no course at all", func(t *testing.T) {
		setUp(t)

		err := execSQL(`INSERT INTO holes (layout_id, hole_number, par) VALUES (NULL, 1, 4)`)

		expectPostgresError(t, err, notNullViolation)
	})
}

func TestCourseRules_HoleNumbersHaveNoUpperLimit(t *testing.T) {
	for _, holeNumber := range []int{18, 36, 100} {
		t.Run(testCaseLabel(holeNumber), func(t *testing.T) {
			testutil.SetupTestDB(t)
			club := buildClub(t, []int{1})

			expectAccepted(t, tryInsertHole(club.LayoutIDs[0], holeNumber))
		})
	}
}

func testCaseLabel(holeNumber int) string {
	return "hole number " + string(rune('0'+holeNumber/100%10)) + string(rune('0'+holeNumber/10%10)) + string(rune('0'+holeNumber%10))
}

func TestCourseRules_HoleNumbersRepeatAcrossCoursesAndClubs(t *testing.T) {
	testutil.SetupTestDB(t)
	buildClub(t, []int{9, 9})
	buildClub(t, []int{9, 9})

	// Building both clubs succeeded, so hole 1 exists in all four courses
	if count := countRows(t, `SELECT COUNT(*) FROM holes WHERE hole_number = 1`); count != 4 {
		t.Errorf("expected hole 1 to exist in 4 courses, found %d", count)
	}
}

func TestCourseRules_AmenityLinks(t *testing.T) {
	t.Run("a hole in the same club", func(t *testing.T) {
		testutil.SetupTestDB(t)
		club := buildClub(t, []int{9})

		expectAccepted(t, tryInsertAmenity(club.CourseID, &club.HoleIDs[0][0]))
	})

	t.Run("no hole, like a clubhouse", func(t *testing.T) {
		testutil.SetupTestDB(t)
		club := buildClub(t, []int{9})

		expectAccepted(t, tryInsertAmenity(club.CourseID, nil))
	})

	t.Run("a hole that doesn't exist", func(t *testing.T) {
		testutil.SetupTestDB(t)
		club := buildClub(t, []int{9})
		missingHoleID := nonexistentID

		expectPostgresError(t, tryInsertAmenity(club.CourseID, &missingHoleID), foreignKeyViolation)
	})
}

func TestCourseRules_DeletingALayoutRemovesItsHolesOnly(t *testing.T) {
	testutil.SetupTestDB(t)
	club := buildClub(t, []int{9, 9, 9})

	mustExec(t, `DELETE FROM layouts WHERE id = $1`, club.LayoutIDs[1])

	if count := countRows(t, `SELECT COUNT(*) FROM holes WHERE layout_id = $1`, club.LayoutIDs[1]); count != 0 {
		t.Errorf("the deleted course should have no holes left, found %d", count)
	}
	for _, survivingIndex := range []int{0, 2} {
		if count := countRows(t, `SELECT COUNT(*) FROM holes WHERE layout_id = $1`, club.LayoutIDs[survivingIndex]); count != 9 {
			t.Errorf("course %d should keep all 9 holes, found %d", survivingIndex+1, count)
		}
	}
	if count := countRows(t, `SELECT COUNT(*) FROM layouts WHERE course_id = $1`, club.CourseID); count != 2 {
		t.Errorf("expected 2 courses left, found %d", count)
	}
}

func TestCourseRules_DeletingALayoutKeepsItsAmenitiesButUnlinksThem(t *testing.T) {
	testutil.SetupTestDB(t)
	club := buildClub(t, []int{9, 9})
	amenityID := insertAmenity(t, club.CourseID, "Comfort Station 2", "comfort_station", &club.HoleIDs[1][5])

	mustExec(t, `DELETE FROM layouts WHERE id = $1`, club.LayoutIDs[1])

	if count := countRows(t, `SELECT COUNT(*) FROM amenities WHERE id = $1`, amenityID); count != 1 {
		t.Fatalf("the amenity should survive its course being deleted, found %d", count)
	}
	if count := countRows(t, `SELECT COUNT(*) FROM amenities WHERE id = $1 AND hole_id IS NULL`, amenityID); count != 1 {
		t.Errorf("the amenity should no longer point at a deleted hole")
	}
}

func TestCourseRules_DeletingAHoleKeepsItsAmenityButUnlinksIt(t *testing.T) {
	testutil.SetupTestDB(t)
	club := buildClub(t, []int{9})
	linkedAmenityID := insertAmenity(t, club.CourseID, "Comfort Station", "comfort_station", &club.HoleIDs[0][6])
	untouchedAmenityID := insertAmenity(t, club.CourseID, "Water Cooler", "water_cooler", &club.HoleIDs[0][2])

	mustExec(t, `DELETE FROM holes WHERE id = $1`, club.HoleIDs[0][6])

	if count := countRows(t, `SELECT COUNT(*) FROM amenities WHERE id = $1 AND hole_id IS NULL`, linkedAmenityID); count != 1 {
		t.Errorf("the amenity on the deleted hole should survive, with no hole")
	}
	if count := countRows(t, `SELECT COUNT(*) FROM amenities WHERE id = $1 AND hole_id = $2`, untouchedAmenityID, club.HoleIDs[0][2]); count != 1 {
		t.Errorf("an amenity on a different hole should keep its link")
	}
}

func TestCourseRules_DeletingAClubRemovesEverythingInItAndNothingElse(t *testing.T) {
	testutil.SetupTestDB(t)
	deletedClub := buildClub(t, []int{9, 9})
	keptClub := buildClub(t, []int{9, 9, 9})
	insertAmenity(t, deletedClub.CourseID, "Clubhouse", "clubhouse", nil)
	insertAmenity(t, deletedClub.CourseID, "Comfort Station", "comfort_station", &deletedClub.HoleIDs[0][4])
	insertAmenity(t, keptClub.CourseID, "Clubhouse", "clubhouse", nil)

	mustExec(t, `DELETE FROM courses WHERE id = $1`, deletedClub.CourseID)

	if count := countRows(t, `SELECT COUNT(*) FROM layouts WHERE course_id = $1`, deletedClub.CourseID); count != 0 {
		t.Errorf("the deleted club should have no courses left, found %d", count)
	}
	if count := holesInClub(t, deletedClub.CourseID); count != 0 {
		t.Errorf("the deleted club should have no holes left, found %d", count)
	}
	if count := countRows(t, `SELECT COUNT(*) FROM amenities WHERE course_id = $1`, deletedClub.CourseID); count != 0 {
		t.Errorf("the deleted club should have no amenities left, found %d", count)
	}

	if count := countRows(t, `SELECT COUNT(*) FROM layouts WHERE course_id = $1`, keptClub.CourseID); count != 3 {
		t.Errorf("the other club should keep its 3 courses, found %d", count)
	}
	if count := holesInClub(t, keptClub.CourseID); count != 27 {
		t.Errorf("the other club should keep its 27 holes, found %d", count)
	}
	if count := countRows(t, `SELECT COUNT(*) FROM amenities WHERE course_id = $1`, keptClub.CourseID); count != 1 {
		t.Errorf("the other club should keep its amenity, found %d", count)
	}
}

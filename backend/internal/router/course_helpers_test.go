package router_test

import (
	"context"
	"testing"

	"golf-maintenance/backend/internal/db"
)

const (
	testClubName   = "Dagobah Pines Golf Club"
	defaultHolePar = 4
	defaultYardage = 400
)

func pointerTo[Value any](value Value) *Value {
	return &value
}

// A club made by buildClub, with the ids a test needs to look things up
type builtClub struct {
	CourseID  string
	LayoutIDs []string   // in play order
	HoleIDs   [][]string // HoleIDs[courseIndex][holeNumber-1]
}

func execSQL(sql string, args ...any) error {
	_, err := db.Pool.Exec(context.Background(), sql, args...)
	return err
}

func mustExec(t *testing.T, sql string, args ...any) {
	t.Helper()
	if err := execSQL(sql, args...); err != nil {
		t.Fatalf("could not run %q: %v", sql, err)
	}
}

func insertedID(t *testing.T, sql string, args ...any) string {
	t.Helper()
	var id string
	if err := db.Pool.QueryRow(context.Background(), sql, args...).Scan(&id); err != nil {
		t.Fatalf("could not insert: %v", err)
	}
	return id
}

func countRows(t *testing.T, sql string, args ...any) int {
	t.Helper()
	var count int
	if err := db.Pool.QueryRow(context.Background(), sql, args...).Scan(&count); err != nil {
		t.Fatalf("could not count rows: %v", err)
	}
	return count
}

func insertCourse(t *testing.T, name string) string {
	t.Helper()
	return insertedID(t, `INSERT INTO courses (name) VALUES ($1) RETURNING id`, name)
}

func insertLayout(t *testing.T, courseID, name string, code *string, position int, frontHoleCount *int) string {
	t.Helper()
	return insertedID(t,
		`INSERT INTO layouts (course_id, name, code, position, front_hole_count)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		courseID, name, code, position, frontHoleCount,
	)
}

func insertHole(t *testing.T, layoutID string, holeNumber, par int, yardage *int) string {
	t.Helper()
	return insertedID(t,
		`INSERT INTO holes (layout_id, hole_number, par, yardage)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		layoutID, holeNumber, par, yardage,
	)
}

func insertAmenity(t *testing.T, courseID, name, amenityType string, holeID *string) string {
	t.Helper()
	return insertedID(t,
		`INSERT INTO amenities (course_id, name, type, hole_id)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		courseID, name, amenityType, holeID,
	)
}

// 0 -> "A", 1 -> "B", and so on
func layoutCode(index int) string {
	return string(rune('A' + index))
}

// Builds a club whose courses have the given numbers of holes: "Course A" with code A,
// "Course B" with code B, and so on, in that play order. Everything is inserted in reverse
// on purpose, so a response that comes back in order can only have been sorted by the handler.
func buildClub(t *testing.T, layoutSizes []int) builtClub {
	t.Helper()
	club := builtClub{
		CourseID:  insertCourse(t, testClubName),
		LayoutIDs: make([]string, len(layoutSizes)),
		HoleIDs:   make([][]string, len(layoutSizes)),
	}

	for index := len(layoutSizes) - 1; index >= 0; index-- {
		code := layoutCode(index)
		club.LayoutIDs[index] = insertLayout(t, club.CourseID, "Course "+code, &code, index+1, nil)
		club.HoleIDs[index] = make([]string, layoutSizes[index])

		for holeNumber := layoutSizes[index]; holeNumber >= 1; holeNumber-- {
			club.HoleIDs[index][holeNumber-1] = insertHole(
				t, club.LayoutIDs[index], holeNumber, defaultHolePar, pointerTo(defaultYardage),
			)
		}
	}

	return club
}

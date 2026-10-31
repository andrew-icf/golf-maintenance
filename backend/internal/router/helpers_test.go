package router_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/router"
	"golf-maintenance/backend/internal/testutil"
)

// Every helper shared by more than one test file lives here, in sections, so any of them is
// easy to find. A helper used by only one file stays at the top of that file.

// ---- Sending requests and reading responses ----

func sendRequest(handler http.Handler, method, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		request.AddCookie(cookie)
	}

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

func decodeJSONObject(t *testing.T, responseBody []byte) map[string]any {
	t.Helper()
	var decoded map[string]any
	if err := json.Unmarshal(responseBody, &decoded); err != nil {
		t.Fatalf("could not decode response %q: %v", string(responseBody), err)
	}
	return decoded
}

func decodeJSONList(t *testing.T, responseBody []byte) []map[string]any {
	t.Helper()
	var decoded []map[string]any
	if err := json.Unmarshal(responseBody, &decoded); err != nil {
		t.Fatalf("could not decode response %q: %v", string(responseBody), err)
	}
	return decoded
}

// ---- People and sessions ----

// A person in the test database, with a session so a test can send requests as them
type testPerson struct {
	id     string
	cookie *http.Cookie
}

func newPerson(t *testing.T, email, role string) testPerson {
	t.Helper()
	userID := testutil.CreateUser(t, email, "password123", role)
	return testPerson{id: userID, cookie: testutil.SessionCookie(t, userID)}
}

func newNamedPerson(t *testing.T, email, role, fullName string) testPerson {
	t.Helper()
	person := newPerson(t, email, role)
	setFullName(t, person.id, fullName)
	return person
}

func setFullName(t *testing.T, userID, fullName string) {
	t.Helper()
	_, err := db.Pool.Exec(
		context.Background(),
		`UPDATE users SET full_name = $1 WHERE id = $2`,
		fullName, userID,
	)
	if err != nil {
		t.Fatalf("could not set name: %v", err)
	}
}

// A signed-in person together with a router, ready to send requests
type signedIn struct {
	testPerson
	handler http.Handler
}

// Go has no beforeEach, so a test calls ONE of these three first. Each wipes the database,
// so anything else the test needs (more people, a club, shifts) is added after it. Calling
// two of them in one test would wipe the first.
func setUpStaff(t *testing.T) signedIn {
	t.Helper()
	testutil.SetupTestDB(t)
	return signedIn{testPerson: newPerson(t, "staff@example.com", "staff"), handler: router.New()}
}

func setUpClockedInStaff(t *testing.T) signedIn {
	t.Helper()
	staff := setUpStaff(t)
	testutil.ClockIn(t, staff.id)
	return staff
}

// Admins are exempt from the clock rule, so there is no clocked-in version of this
func setUpAdmin(t *testing.T) signedIn {
	t.Helper()
	testutil.SetupTestDB(t)
	return signedIn{testPerson: newPerson(t, "admin@example.com", "admin"), handler: router.New()}
}

// ---- Running SQL directly ----

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

// A well-formed id that belongs to nothing
const nonexistentID = "00000000-0000-0000-0000-000000000000"

func pointerTo[Value any](value Value) *Value {
	return &value
}

// ---- A club: courses, holes, and amenities ----

const (
	testClubName   = "Dagobah Pines Golf Club"
	defaultHolePar = 4
	defaultYardage = 400
)

// A club made by buildClub, with the ids a test needs to look things up
type builtClub struct {
	CourseID  string
	LayoutIDs []string   // in play order
	HoleIDs   [][]string // HoleIDs[courseIndex][holeNumber-1]
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

// ---- Shifts ----

type storedShift struct {
	UserID    string
	ShiftDate string
	StartTime string
	EndTime   string
}

func insertShift(t *testing.T, userID, shiftDate, startTime, endTime string) string {
	t.Helper()
	var shiftID string
	err := db.Pool.QueryRow(
		context.Background(),
		`INSERT INTO schedules (user_id, shift_date, start_time, end_time)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		userID, shiftDate, startTime, endTime,
	).Scan(&shiftID)
	if err != nil {
		t.Fatalf("could not insert shift: %v", err)
	}
	return shiftID
}

func loadShift(t *testing.T, shiftID string) storedShift {
	t.Helper()
	var shift storedShift
	err := db.Pool.QueryRow(
		context.Background(),
		`SELECT user_id::text, shift_date::text, start_time::text, end_time::text
		 FROM schedules WHERE id = $1`,
		shiftID,
	).Scan(&shift.UserID, &shift.ShiftDate, &shift.StartTime, &shift.EndTime)
	if err != nil {
		t.Fatalf("could not load shift %s: %v", shiftID, err)
	}
	return shift
}

func shiftDates(t *testing.T, responseBody []byte) []string {
	t.Helper()
	dates := []string{}
	for _, shift := range decodeJSONList(t, responseBody) {
		date, _ := shift["shift_date"].(string)
		dates = append(dates, date)
	}
	return dates
}

// ---- Shared test data ----

// Date ranges every schedule endpoint must refuse with a 400, as the query string that
// follows the path
var invalidRangeQueries = []struct {
	name  string
	query string
}{
	{"start without end", "start=2026-10-04"},
	{"end without start", "end=2026-10-10"},
	{"malformed start", "start=banana&end=2026-10-10"},
	{"malformed end", "start=2026-10-04&end=banana"},
	{"date without zero padding", "start=2026-10-4&end=2026-10-10"},
	{"end before start", "start=2026-10-10&end=2026-10-04"},
	{"range of 63 days", "start=2026-01-01&end=2026-03-05"},
}

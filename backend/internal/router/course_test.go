package router_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"testing"

	"golf-maintenance/backend/internal/router"
	"golf-maintenance/backend/internal/testutil"
)

// What /api/course sends back
type holeResponse struct {
	ID         string `json:"id"`
	LayoutID   string `json:"layout_id"`
	HoleNumber int    `json:"hole_number"`
	Par        int    `json:"par"`
	Yardage    *int   `json:"yardage"`
}

type layoutResponse struct {
	ID             string         `json:"id"`
	Name           string         `json:"name"`
	Code           *string        `json:"code"`
	Position       int            `json:"position"`
	FrontHoleCount *int           `json:"front_hole_count"`
	Holes          []holeResponse `json:"holes"`
}

type amenityResponse struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Type   string  `json:"type"`
	HoleID *string `json:"hole_id"`
}

type courseResponse struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Layouts   []layoutResponse  `json:"layouts"`
	Holes     []holeResponse    `json:"holes"`
	Amenities []amenityResponse `json:"amenities"`
}

// Club shapes that exist in the real world, so nothing is tied to 18 holes or to multiples of 9
var clubShapes = []struct {
	label       string
	layoutSizes []int
}{
	{"a single hole", []int{1}},
	{"a six-hole course", []int{6}},
	{"a nine-hole club", []int{9}},
	{"a twelve-hole course", []int{12}},
	{"an 18-hole club as one course", []int{18}},
	{"an 18-hole club as two nines", []int{9, 9}},
	{"a nine and a six", []int{9, 6}},
	{"three nines", []int{9, 9, 9}},
	{"two 18-hole courses", []int{18, 18}},
	{"four nines", []int{9, 9, 9, 9}},
}

// Where the comfort stations sit, as course letter plus hole number
const (
	comfortStationOneHole   = "A5"
	comfortStationTwoHole   = "B6"
	comfortStationThreeHole = "C7"
)

// Actions
func loggedInStaffCookie(t *testing.T) *http.Cookie {
	t.Helper()
	userID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	return testutil.SessionCookie(t, userID)
}

func fetchCourse(t *testing.T, cookie *http.Cookie) courseResponse {
	t.Helper()
	recorder := sendRequest(router.New(), http.MethodGet, "/api/course", "", cookie)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}

	var course courseResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &course); err != nil {
		t.Fatalf("could not decode response %q: %v", recorder.Body.String(), err)
	}
	return course
}

func holeIDsOf(holes []holeResponse) []string {
	ids := []string{}
	for _, hole := range holes {
		ids = append(ids, hole.ID)
	}
	return ids
}

// "A5", "C7": the label every hole in the response would carry on screen
func holeLabels(course courseResponse) map[string]string {
	labels := map[string]string{}
	for _, layout := range course.Layouts {
		for _, hole := range layout.Holes {
			labels[hole.ID] = fmt.Sprintf("%s%d", *layout.Code, hole.HoleNumber)
		}
	}
	return labels
}

func TestGetCourse_ClubShapes(t *testing.T) {
	for _, shape := range clubShapes {
		t.Run(shape.label, func(t *testing.T) {
			testutil.SetupTestDB(t)
			club := buildClub(t, shape.layoutSizes)

			course := fetchCourse(t, loggedInStaffCookie(t))

			if len(course.Layouts) != len(shape.layoutSizes) {
				t.Fatalf("expected %d courses, got %d", len(shape.layoutSizes), len(course.Layouts))
			}

			expectedHoleCount := 0
			nestedHoleIDs := []string{}
			for layoutIndex, layout := range course.Layouts {
				size := shape.layoutSizes[layoutIndex]
				expectedHoleCount += size

				if layout.ID != club.LayoutIDs[layoutIndex] {
					t.Errorf("course %d came back out of play order", layoutIndex+1)
				}
				if layout.Position != layoutIndex+1 {
					t.Errorf("course %d reports position %d", layoutIndex+1, layout.Position)
				}
				if len(layout.Holes) != size {
					t.Fatalf("course %d: expected %d holes, got %d", layoutIndex+1, size, len(layout.Holes))
				}

				for holeIndex, hole := range layout.Holes {
					if hole.ID != club.HoleIDs[layoutIndex][holeIndex] {
						t.Errorf("course %d: hole %d is out of order", layoutIndex+1, holeIndex+1)
					}
					if hole.HoleNumber != holeIndex+1 {
						t.Errorf("course %d: expected hole number %d, got %d", layoutIndex+1, holeIndex+1, hole.HoleNumber)
					}
					if hole.LayoutID != layout.ID {
						t.Errorf("course %d: hole %d names the wrong course", layoutIndex+1, hole.HoleNumber)
					}
					nestedHoleIDs = append(nestedHoleIDs, hole.ID)
				}
			}

			if len(course.Holes) != expectedHoleCount {
				t.Errorf("expected %d holes in the flat list, got %d", expectedHoleCount, len(course.Holes))
			}
			if !reflect.DeepEqual(holeIDsOf(course.Holes), nestedHoleIDs) {
				t.Errorf("the flat hole list should match the courses' holes, in the same order")
			}
		})
	}
}

func TestGetCourse_LayoutDetails(t *testing.T) {
	testutil.SetupTestDB(t)
	courseID := insertCourse(t, testClubName)
	insertLayout(t, courseID, "Course A", pointerTo("A"), 1, pointerTo(5))
	insertLayout(t, courseID, "Back Course", nil, 2, nil)

	course := fetchCourse(t, loggedInStaffCookie(t))

	if course.Name != testClubName {
		t.Errorf("expected the club name %q, got %q", testClubName, course.Name)
	}
	if len(course.Layouts) != 2 {
		t.Fatalf("expected 2 courses, got %d", len(course.Layouts))
	}

	withDetails := course.Layouts[0]
	if withDetails.Name != "Course A" || withDetails.Position != 1 {
		t.Errorf("unexpected first course: %+v", withDetails)
	}
	if withDetails.Code == nil || *withDetails.Code != "A" {
		t.Errorf("expected code A, got %v", withDetails.Code)
	}
	if withDetails.FrontHoleCount == nil || *withDetails.FrontHoleCount != 5 {
		t.Errorf("expected a front hole count of 5, got %v", withDetails.FrontHoleCount)
	}

	withoutDetails := course.Layouts[1]
	if withoutDetails.Name != "Back Course" || withoutDetails.Position != 2 {
		t.Errorf("unexpected second course: %+v", withoutDetails)
	}
	if withoutDetails.Code != nil {
		t.Errorf("expected no code, got %q", *withoutDetails.Code)
	}
	if withoutDetails.FrontHoleCount != nil {
		t.Errorf("expected no front hole count, got %d", *withoutDetails.FrontHoleCount)
	}
}

func TestGetCourse_HoleDetails(t *testing.T) {
	testutil.SetupTestDB(t)
	courseID := insertCourse(t, testClubName)
	layoutID := insertLayout(t, courseID, "Course A", pointerTo("A"), 1, nil)
	insertHole(t, layoutID, 1, 4, pointerTo(380))
	insertHole(t, layoutID, 2, 3, nil)
	insertHole(t, layoutID, 3, 5, pointerTo(0))

	course := fetchCourse(t, loggedInStaffCookie(t))

	holes := course.Layouts[0].Holes
	if len(holes) != 3 {
		t.Fatalf("expected 3 holes, got %d", len(holes))
	}

	if holes[0].Par != 4 || holes[0].Yardage == nil || *holes[0].Yardage != 380 {
		t.Errorf("hole 1 should be par 4 and 380 yards, got %+v", holes[0])
	}
	if holes[1].Par != 3 || holes[1].Yardage != nil {
		t.Errorf("hole 2 should be par 3 with no yardage, got %+v", holes[1])
	}
	// A yardage of zero is a value, not a missing one
	if holes[2].Par != 5 || holes[2].Yardage == nil || *holes[2].Yardage != 0 {
		t.Errorf("hole 3 should be par 5 with a yardage of zero, got %+v", holes[2])
	}
}

func TestGetCourse_EmptyListsAreListsNotNull(t *testing.T) {
	t.Run("a club with nothing set up yet", func(t *testing.T) {
		testutil.SetupTestDB(t)
		insertCourse(t, testClubName)

		course := fetchCourse(t, loggedInStaffCookie(t))

		if course.Layouts == nil || len(course.Layouts) != 0 {
			t.Errorf("expected an empty list of courses, got %v", course.Layouts)
		}
		if course.Holes == nil || len(course.Holes) != 0 {
			t.Errorf("expected an empty list of holes, got %v", course.Holes)
		}
		if course.Amenities == nil || len(course.Amenities) != 0 {
			t.Errorf("expected an empty list of amenities, got %v", course.Amenities)
		}
	})

	t.Run("a course with no holes yet", func(t *testing.T) {
		testutil.SetupTestDB(t)
		courseID := insertCourse(t, testClubName)
		insertLayout(t, courseID, "Course A", pointerTo("A"), 1, nil)

		course := fetchCourse(t, loggedInStaffCookie(t))

		if len(course.Layouts) != 1 {
			t.Fatalf("expected 1 course, got %d", len(course.Layouts))
		}
		if course.Layouts[0].Holes == nil || len(course.Layouts[0].Holes) != 0 {
			t.Errorf("expected an empty list of holes in the course, got %v", course.Layouts[0].Holes)
		}
		if course.Holes == nil || len(course.Holes) != 0 {
			t.Errorf("expected an empty flat list of holes, got %v", course.Holes)
		}
	})
}

func TestGetCourse_Amenities(t *testing.T) {
	testutil.SetupTestDB(t)
	club := buildClub(t, []int{9, 9, 9})
	insertAmenity(t, club.CourseID, "Driving Range", "driving_range", nil)
	insertAmenity(t, club.CourseID, "Comfort Station 3", "comfort_station", &club.HoleIDs[2][6])
	insertAmenity(t, club.CourseID, "Clubhouse", "clubhouse", nil)
	insertAmenity(t, club.CourseID, "Comfort Station 1", "comfort_station", &club.HoleIDs[0][4])
	insertAmenity(t, club.CourseID, "Comfort Station 2", "comfort_station", &club.HoleIDs[1][5])

	course := fetchCourse(t, loggedInStaffCookie(t))

	// Sorted by name, with the hole each one sits on ("" for a club-level amenity)
	expected := []struct {
		name string
		hole string
	}{
		{"Clubhouse", ""},
		{"Comfort Station 1", comfortStationOneHole},
		{"Comfort Station 2", comfortStationTwoHole},
		{"Comfort Station 3", comfortStationThreeHole},
		{"Driving Range", ""},
	}

	if len(course.Amenities) != len(expected) {
		t.Fatalf("expected %d amenities, got %d", len(expected), len(course.Amenities))
	}

	labels := holeLabels(course)
	for index, amenity := range course.Amenities {
		if amenity.Name != expected[index].name {
			t.Errorf("amenity %d: expected %q, got %q", index+1, expected[index].name, amenity.Name)
			continue
		}

		actualHole := ""
		if amenity.HoleID != nil {
			actualHole = labels[*amenity.HoleID]
			if actualHole == "" {
				t.Errorf("%s points at a hole that isn't in the response", amenity.Name)
			}
		}
		if actualHole != expected[index].hole {
			t.Errorf("%s: expected hole %q, got %q", amenity.Name, expected[index].hole, actualHole)
		}
	}
}

func TestGetCourse_Access(t *testing.T) {
	testutil.SetupTestDB(t)
	buildClub(t, []int{9})
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	handler := router.New()

	testCases := []struct {
		name           string
		cookie         *http.Cookie
		expectedStatus int
	}{
		{"no session", nil, http.StatusUnauthorized},
		{"staff user", testutil.SessionCookie(t, staffID), http.StatusOK},
		{"admin user", testutil.SessionCookie(t, adminID), http.StatusOK},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := sendRequest(handler, http.MethodGet, "/api/course", "", testCase.cookie)

			if recorder.Code != testCase.expectedStatus {
				t.Errorf("expected %d, got %d", testCase.expectedStatus, recorder.Code)
			}
		})
	}
}

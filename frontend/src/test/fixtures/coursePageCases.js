import {
  CLUBHOUSE,
  COMFORT_A5,
  COMFORT_B6,
  COMFORT_C7,
  COURSE_NAME,
  DRIVING_RANGE,
  MAIN_COURSE,
  THREE_NINES,
  holeIdOf,
  makeAmenity,
  makeCourseResponse,
  makeNumberedHoles,
} from './course'

// A /api/course response with amenities. `flatHoles` is the flat list the server still sends
// beside the courses, which the page ignores.
export function makePageResponse(layouts, amenities = [], flatHoles = []) {
  return { ...makeCourseResponse(layouts, { flatHoles }), amenities }
}

// The amenities of a three-nine club, in the order the server sends them (sorted by name)
export const AMENITIES_IN_SERVER_ORDER = [CLUBHOUSE, COMFORT_A5, COMFORT_B6, COMFORT_C7, DRIVING_RANGE]

// What each row of that list says
export const AMENITY_ROW_CASES = [
  { name: 'Clubhouse', location: null },
  { name: 'Comfort Station A5', location: 'On A5' },
  { name: 'Comfort Station B6', location: 'On B6' },
  { name: 'Comfort Station C7', location: 'On C7' },
  { name: 'Driving Range', location: null },
]

// The labels of the three holes that have comfort stations, written out by hand
export const THREE_NINE_HOLE_LABELS = new Map([
  [holeIdOf('A', 5), 'A5'],
  [holeIdOf('B', 6), 'B6'],
  [holeIdOf('C', 7), 'C7'],
])

// A club with one course, where holes are plain "Hole 7"
export const MAIN_COURSE_STATION = makeAmenity('amenity-9', 'Comfort Station', 'comfort_station', holeIdOf('M', 7))
export const MAIN_COURSE_HOLE_LABELS = new Map([[holeIdOf('M', 7), 'Hole 7']])

// An amenity on a hole that has no label in the labels given
export const ORPHAN_AMENITY = makeAmenity('amenity-10', 'Lost Station', 'comfort_station', holeIdOf('Z', 1))

// Whole pages, as the server sends them
export const THREE_NINE_PAGE = makePageResponse(THREE_NINES, AMENITIES_IN_SERVER_ORDER)
export const MAIN_COURSE_PAGE = makePageResponse([MAIN_COURSE], [CLUBHOUSE])
export const NO_COURSES_PAGE = makePageResponse([], AMENITIES_IN_SERVER_ORDER, makeNumberedHoles('F', 5))
export const NO_AMENITIES_PAGE = makePageResponse(THREE_NINES, [])
export const NO_LISTS_PAGE = { id: 'course-1', name: COURSE_NAME }

// What those pages should show
export const THREE_NINE_HEADINGS = ['Course A', 'Course B', 'Course C', 'Amenities']
export const THREE_NINE_GROUP_TITLES = ['Front A', 'Back A', 'Front B', 'Back B', 'Front C', 'Back C']
export const MAIN_COURSE_HEADINGS = ['Holes', 'Amenities']
export const MAIN_COURSE_GROUP_TITLES = ['Front', 'Back']
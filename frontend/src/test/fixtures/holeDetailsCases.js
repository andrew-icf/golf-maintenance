import {
  BACK_COURSE,
  CLUBHOUSE,
  COMFORT_A5,
  COMFORT_C7,
  COURSE_A,
  THREE_NINES,
  WATER_COOLER_C7,
  holeIdOf,
  makeHole,
  makeLayout,
  makeNumberedHoles,
} from './course'
import { LAYOUT_WITHOUT_HOLES_FIELD } from './courseLayoutCases'
import {
  MAIN_COURSE_PAGE,
  NO_COURSES_PAGE,
  NO_LISTS_PAGE,
  THREE_NINE_PAGE,
  makePageResponse,
} from './coursePageCases'
import { MARKUP_AMENITY, UNSPLIT_NINE } from './courseViewCases'

// A multi-course club where one course is not split into front and back
export const UNSPLIT_PAGE = makePageResponse([UNSPLIT_NINE, THREE_NINES[1]], [])

// A multi-course club where one course has a name but no letter
export const UNCODED_COURSE_PAGE = makePageResponse([COURSE_A, BACK_COURSE], [])

// One course whose holes have every kind of yardage
const YARDAGE_LAYOUT = makeLayout({
  name: 'Course Y',
  code: 'Y',
  holes: [makeHole('Y', 1, 4, null), makeHole('Y', 2, 4), makeHole('Y', 3, 4, 0), makeHole('Y', 4, 4, 380)],
})
export const YARDAGE_PAGE = makePageResponse([YARDAGE_LAYOUT], [])

export const YARDAGE_CASES = [
  { label: 'a yardage of null', holeId: holeIdOf('Y', 1), expected: null },
  { label: 'no yardage field at all', holeId: holeIdOf('Y', 2), expected: null },
  { label: 'a yardage of zero, kept as a value', holeId: holeIdOf('Y', 3), expected: 0 },
  { label: 'a yardage', holeId: holeIdOf('Y', 4), expected: 380 },
]

// Amenities on holes and for the whole club
export const MULTI_AMENITY_PAGE = makePageResponse(THREE_NINES, [
  CLUBHOUSE,
  COMFORT_C7,
  WATER_COOLER_C7,
  COMFORT_A5,
])

export const AMENITY_CASES = [
  {
    label: 'a hole with two amenities, in the order given',
    holeId: holeIdOf('C', 7),
    expected: [COMFORT_C7.id, WATER_COOLER_C7.id],
  },
  { label: 'a hole with one amenity', holeId: holeIdOf('A', 5), expected: [COMFORT_A5.id] },
  { label: 'a hole with none', holeId: holeIdOf('A', 1), expected: [] },
]

export const FROZEN_PAGE = Object.freeze({
  ...THREE_NINE_PAGE,
  layouts: Object.freeze([...THREE_NINE_PAGE.layouts]),
  amenities: Object.freeze([...THREE_NINE_PAGE.amenities]),
})

// What the page shows for each kind of hole
export const HOLE_DETAILS_CASES = [
  {
    label: 'A1, the first hole of a front nine',
    course: THREE_NINE_PAGE,
    holeId: holeIdOf('A', 1),
    expected: { id: holeIdOf('A', 1), label: 'A1', courseName: 'Course A', groupTitle: 'Front A', par: 4, yardage: 409 },
  },
  {
    label: 'A5, the last hole of a front nine',
    course: THREE_NINE_PAGE,
    holeId: holeIdOf('A', 5),
    expected: { id: holeIdOf('A', 5), label: 'A5', courseName: 'Course A', groupTitle: 'Front A', par: 3, yardage: 191 },
  },
  {
    label: 'A6, the first hole of a back nine',
    course: THREE_NINE_PAGE,
    holeId: holeIdOf('A', 6),
    expected: { id: holeIdOf('A', 6), label: 'A6', courseName: 'Course A', groupTitle: 'Back A', par: 4, yardage: 363 },
  },
  {
    label: 'B6 on the second course',
    course: THREE_NINE_PAGE,
    holeId: holeIdOf('B', 6),
    expected: { id: holeIdOf('B', 6), label: 'B6', courseName: 'Course B', groupTitle: 'Back B', par: 5, yardage: 546 },
  },
  {
    label: 'C7 on the third course',
    course: THREE_NINE_PAGE,
    holeId: holeIdOf('C', 7),
    expected: { id: holeIdOf('C', 7), label: 'C7', courseName: 'Course C', groupTitle: 'Back C', par: 3, yardage: 210 },
  },
  {
    label: 'C9, the last hole of the last course',
    course: THREE_NINE_PAGE,
    holeId: holeIdOf('C', 9),
    expected: { id: holeIdOf('C', 9), label: 'C9', courseName: 'Course C', groupTitle: 'Back C', par: 5, yardage: 532 },
  },
  {
    label: 'hole 4 of a club with one course',
    course: MAIN_COURSE_PAGE,
    holeId: holeIdOf('M', 4),
    expected: { id: holeIdOf('M', 4), label: 'Hole 4', courseName: null, groupTitle: 'Front', par: 4, yardage: 400 },
  },
  {
    label: 'hole 12 of a club with one course',
    course: MAIN_COURSE_PAGE,
    holeId: holeIdOf('M', 12),
    expected: { id: holeIdOf('M', 12), label: 'Hole 12', courseName: null, groupTitle: 'Back', par: 4, yardage: 400 },
  },
  {
    label: 'a hole of a course that is not split',
    course: UNSPLIT_PAGE,
    holeId: holeIdOf('A', 3),
    expected: { id: holeIdOf('A', 3), label: 'A3', courseName: 'Course A', groupTitle: null, par: 3, yardage: 168 },
  },
  {
    label: 'a hole of a course with no letter',
    course: UNCODED_COURSE_PAGE,
    holeId: holeIdOf('K', 4),
    expected: {
      id: holeIdOf('K', 4),
      label: 'Back Course 4',
      courseName: 'Back Course',
      groupTitle: null,
      par: 4,
      yardage: 400,
    },
  },
]

export const NOT_FOUND_CASES = [
  { label: 'an id that no hole has', course: THREE_NINE_PAGE, holeId: 'hole-Z9' },
  { label: 'an id that only the old flat list has', course: NO_COURSES_PAGE, holeId: holeIdOf('F', 1) },
  { label: 'a club with no courses', course: makePageResponse([], []), holeId: holeIdOf('A', 1) },
  {
    label: 'a course with no holes field',
    course: makePageResponse([LAYOUT_WITHOUT_HOLES_FIELD], []),
    holeId: holeIdOf('A', 1),
  },
  { label: 'a response with no lists at all', course: NO_LISTS_PAGE, holeId: holeIdOf('A', 1) },
]

export const MISSING_ID_CASES = [
  { label: 'an empty id', holeId: '' },
  { label: 'no id', holeId: undefined },
  { label: 'a null id', holeId: null },
]

export const MISSING_COURSE_CASES = [
  { label: 'null', course: null },
  { label: 'undefined', course: undefined },
]

// A club with one course that is not split into front and back
export const SINGLE_UNSPLIT_PAGE = makePageResponse(
  [makeLayout({ name: 'Main', holes: makeNumberedHoles('M', 9) })],
  []
)

// What the page shows for each kind of hole: the heading, the line under it, par, and yardage
export const HOLE_PAGE_CASES = [
  {
    label: 'a front hole in a multi-course club',
    course: THREE_NINE_PAGE,
    holeId: holeIdOf('A', 1),
    heading: 'A1',
    subtitle: 'Course A · Front A',
    par: '4',
    yardage: '409 yds',
  },
  {
    label: 'a back hole in a multi-course club',
    course: THREE_NINE_PAGE,
    holeId: holeIdOf('C', 7),
    heading: 'C7',
    subtitle: 'Course C · Back C',
    par: '3',
    yardage: '210 yds',
  },
  {
    label: 'a hole in a club with one split course',
    course: MAIN_COURSE_PAGE,
    holeId: holeIdOf('M', 4),
    heading: 'Hole 4',
    subtitle: 'Front',
    par: '4',
    yardage: '400 yds',
  },
  {
    label: 'a hole of a course that is not split',
    course: UNSPLIT_PAGE,
    holeId: holeIdOf('A', 3),
    heading: 'A3',
    subtitle: 'Course A',
    par: '3',
    yardage: '168 yds',
  },
  {
    label: 'a hole in a club with one course that is not split',
    course: SINGLE_UNSPLIT_PAGE,
    holeId: holeIdOf('M', 3),
    heading: 'Hole 3',
    subtitle: null,
    par: '4',
    yardage: '400 yds',
  },
]

// The amenities the page lists for a hole, by name and by type label
export const AMENITIES_ON_HOLE_CASES = [
  {
    label: 'a hole with two amenities',
    holeId: holeIdOf('C', 7),
    names: [COMFORT_C7.name, WATER_COOLER_C7.name],
    types: ['Comfort station', 'water_cooler'],
  },
  {
    label: 'a hole with one amenity',
    holeId: holeIdOf('A', 5),
    names: [COMFORT_A5.name],
    types: ['Comfort station'],
  },
]
export const HOLE_WITH_NO_AMENITIES_ID = holeIdOf('A', 1)

// An amenity whose name contains markup, sitting on hole C7
export const MARKUP_AMENITY_PAGE = makePageResponse(THREE_NINES, [MARKUP_AMENITY])
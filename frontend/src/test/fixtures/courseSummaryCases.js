import {
  COURSE_NAME,
  makeClubLayouts,
  makeClubResponse,
  makeCourseResponse,
  makeHole,
  makeLayout,
  makeNumberedHoles,
} from './course'

// Holes with no yardage across two courses: one null, one with the field missing entirely
export const PARTIAL_COURSE = makeCourseResponse([
  makeLayout({
    name: 'Course A',
    code: 'A',
    position: 1,
    holes: [makeHole('A', 1, 4, 380), makeHole('A', 2, 4, null), makeHole('A', 3, 4, 510)],
  }),
  makeLayout({
    name: 'Course B',
    code: 'B',
    position: 2,
    holes: [makeHole('B', 1, 4), makeHole('B', 2, 4, 400)],
  }),
])
export const PARTIAL_HOLE_COUNT = 5
export const PARTIAL_TOTAL = 1290
export const PARTIAL_MISSING_COUNT = 2

export const NO_YARDAGE_COURSE = makeCourseResponse([
  makeLayout({
    name: 'Course A',
    code: 'A',
    position: 1,
    holes: [makeHole('A', 1, 4, null), makeHole('A', 2, 4)],
  }),
  makeLayout({ name: 'Course B', code: 'B', position: 2, holes: [makeHole('B', 1, 4)] }),
])
export const NO_YARDAGE_HOLE_COUNT = 3

// The summary counts the holes inside the courses, not the flat list the server also sends
export const FLAT_LIST_COURSE = makeCourseResponse(makeClubLayouts([9]), {
  flatHoles: makeNumberedHoles('F', 18),
})
export const FLAT_LIST_HOLE_COUNT = 9

export const FROZEN_COURSE = Object.freeze(
  makeCourseResponse(
    Object.freeze([
      makeLayout({ name: 'Course A', code: 'A', holes: Object.freeze([makeHole('A', 1, 4, 400)]) }),
    ])
  )
)

// What the sidebar passes before the course has loaded, or if the response has gaps
export const EMPTY_SUMMARY = {
  name: '',
  layoutCount: 0,
  holeCount: 0,
  totalYardage: null,
  holesMissingYardage: 0,
}

export const EMPTY_INPUT_CASES = [
  { label: 'null', course: null, expected: EMPTY_SUMMARY },
  { label: 'undefined', course: undefined, expected: EMPTY_SUMMARY },
  {
    label: 'a response with no courses field',
    course: { name: COURSE_NAME },
    expected: { ...EMPTY_SUMMARY, name: COURSE_NAME },
  },
  {
    label: 'a club with no courses yet',
    course: makeCourseResponse([]),
    expected: { ...EMPTY_SUMMARY, name: COURSE_NAME },
  },
  {
    label: 'a course with no holes field',
    course: makeCourseResponse([{ id: 'layout-A', name: 'Course A' }]),
    expected: { ...EMPTY_SUMMARY, name: COURSE_NAME, layoutCount: 1 },
  },
  {
    label: 'three courses with no holes yet',
    course: makeClubResponse([0, 0, 0]),
    expected: { ...EMPTY_SUMMARY, name: COURSE_NAME, layoutCount: 3 },
  },
]

export const HOLE_COUNT_TEXT_CASES = [
  { count: 0, expected: '0 holes' },
  { count: 1, expected: '1 hole' },
  { count: 2, expected: '2 holes' },
  { count: 18, expected: '18 holes' },
  { count: 27, expected: '27 holes' },
]

export const COURSE_SIZE_CASES = [
  { label: 'three nines', holeCount: 27, layoutCount: 3, expected: '27 holes · 3 courses' },
  { label: 'four nines', holeCount: 36, layoutCount: 4, expected: '36 holes · 4 courses' },
  { label: 'two courses of 18', holeCount: 36, layoutCount: 2, expected: '36 holes · 2 courses' },
  { label: 'an 18-hole club as two nines', holeCount: 18, layoutCount: 2, expected: '18 holes · 2 courses' },
  { label: 'an 18-hole club as one course', holeCount: 18, layoutCount: 1, expected: '18 holes' },
  { label: 'a nine-hole club', holeCount: 9, layoutCount: 1, expected: '9 holes' },
  { label: 'a single hole', holeCount: 1, layoutCount: 1, expected: '1 hole' },
  { label: 'a club with no holes yet', holeCount: 0, layoutCount: 0, expected: '0 holes' },
  { label: 'several courses with no holes yet', holeCount: 0, layoutCount: 3, expected: '0 holes · 3 courses' },
  { label: 'holes with no course count', holeCount: 12, layoutCount: 0, expected: '12 holes' },
]

export const YARDAGE_TEXT_CASES = [
  { label: 'no total', total: null, expected: '—' },
  { label: 'zero', total: 0, expected: '0 yds' },
  { label: 'three digits, with no separator', total: 999, expected: '999 yds' },
  { label: 'a typical total', total: 6680, expected: '6,680 yds' },
  { label: 'exactly ten thousand', total: 10000, expected: '10,000 yds' },
  { label: 'a larger total', total: 12345, expected: '12,345 yds' },
]
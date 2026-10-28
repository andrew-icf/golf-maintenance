import {
  BACK_COURSE,
  COURSE_A,
  COURSE_C,
  HOLE_C7,
  MAIN_COURSE,
  NINES,
  THREE_NINES,
  makeHole,
  makeLayout,
  makeNine,
} from './course'

function numbersFrom(first, last) {
  return Array.from({ length: last - first + 1 }, (unusedItem, index) => first + index)
}

export const LABEL_CASES = [
  { label: 'a coded course in a multi-course club', layout: COURSE_C, hole: HOLE_C7, layoutCount: 3, expected: 'C7' },
  { label: 'the first hole of the first course', layout: COURSE_A, hole: COURSE_A.holes[0], layoutCount: 3, expected: 'A1' },
  { label: 'a two-digit hole number', layout: MAIN_COURSE, hole: MAIN_COURSE.holes[17], layoutCount: 1, expected: 'Hole 18' },
  {
    label: 'a coded course with a two-digit hole number',
    layout: { ...MAIN_COURSE, code: 'M' },
    hole: MAIN_COURSE.holes[11],
    layoutCount: 2,
    expected: 'M12',
  },
  { label: 'a course with no code in a multi-course club', layout: BACK_COURSE, hole: BACK_COURSE.holes[3], layoutCount: 2, expected: 'Back Course 4' },
  { label: 'a coded course in a club with one course', layout: COURSE_C, hole: HOLE_C7, layoutCount: 1, expected: 'Hole 7' },
  { label: 'no course count at all', layout: COURSE_C, hole: HOLE_C7, layoutCount: 0, expected: 'Hole 7' },
]

export const RANGE_CASES = [
  { label: 'the front of a coded course', layout: COURSE_C, holes: COURSE_C.holes.slice(0, 5), layoutCount: 3, expected: 'C1–C5' },
  { label: 'the back of a coded course', layout: COURSE_C, holes: COURSE_C.holes.slice(5), layoutCount: 3, expected: 'C6–C9' },
  { label: 'a single hole of a coded course', layout: COURSE_C, holes: [HOLE_C7], layoutCount: 3, expected: 'C7' },
  { label: 'the front of a club with one course', layout: MAIN_COURSE, holes: MAIN_COURSE.holes.slice(0, 9), layoutCount: 1, expected: '1–9' },
  { label: 'the back of a club with one course', layout: MAIN_COURSE, holes: MAIN_COURSE.holes.slice(9), layoutCount: 1, expected: '10–18' },
  { label: 'a course with no code in a multi-course club', layout: BACK_COURSE, holes: BACK_COURSE.holes.slice(0, 5), layoutCount: 2, expected: '1–5' },
  { label: 'a single hole of a club with one course', layout: MAIN_COURSE, holes: [MAIN_COURSE.holes[3]], layoutCount: 1, expected: '4' },
  { label: 'no holes at all', layout: COURSE_C, holes: [], layoutCount: 3, expected: '' },
]

export const SPLIT_CASES = [
  { label: 'a nine with a front of five', layout: COURSE_A, front: numbersFrom(1, 5), back: numbersFrom(6, 9) },
  { label: 'an 18-hole course with a front of nine', layout: MAIN_COURSE, front: numbersFrom(1, 9), back: numbersFrom(10, 18) },
  { label: 'a front of one hole', layout: makeNine(NINES[0], 0, 1), front: [1], back: numbersFrom(2, 9) },
  { label: 'a front that leaves one hole at the back', layout: makeNine(NINES[0], 0, 8), front: numbersFrom(1, 8), back: [9] },
  {
    label: 'numbering with a gap',
    layout: makeLayout({
      name: 'Gapped',
      code: 'G',
      frontHoleCount: 3,
      holes: [1, 2, 4, 5, 7].map((number) => makeHole('G', number, 4, 400)),
    }),
    front: [1, 2],
    back: [4, 5, 7],
  },
]

export const NO_SPLIT_CASES = [
  { label: 'no front count', layout: makeNine(NINES[0], 0, null) },
  { label: 'a front count of zero', layout: makeNine(NINES[0], 0, 0) },
  { label: 'a negative front count', layout: makeNine(NINES[0], 0, -3) },
  { label: 'a front count covering every hole', layout: makeNine(NINES[0], 0, 9) },
  { label: 'a front count beyond the last hole', layout: makeNine(NINES[0], 0, 12) },
  { label: 'a front count that is not a number', layout: makeNine(NINES[0], 0, '5') },
  { label: 'a course with no holes yet', layout: makeLayout({ name: 'Empty', code: 'E', frontHoleCount: 5, holes: [] }) },
]

// Holes that arrive out of order stay in the order they arrive in, on each side
export const SHUFFLED_LAYOUT = makeLayout({
  name: 'Shuffled',
  code: 'S',
  frontHoleCount: 2,
  holes: [3, 1, 2, 5, 4].map((number) => makeHole('S', number, 4, 400)),
})
export const SHUFFLED_FRONT = [1, 2]
export const SHUFFLED_BACK = [3, 5, 4]

export const FROZEN_LAYOUT = Object.freeze({
  ...COURSE_A,
  holes: Object.freeze([...COURSE_A.holes]),
})

export const GROUP_TITLE_CASES = [
  { label: 'the front of a coded course in a multi-course club', key: 'front', layout: COURSE_C, layoutCount: 3, expected: 'Front C' },
  { label: 'the back of a coded course in a multi-course club', key: 'back', layout: COURSE_C, layoutCount: 3, expected: 'Back C' },
  { label: 'the front of a club with one course', key: 'front', layout: MAIN_COURSE, layoutCount: 1, expected: 'Front' },
  { label: 'the back of a club with one course', key: 'back', layout: MAIN_COURSE, layoutCount: 1, expected: 'Back' },
  { label: 'a coded course in a club with one course', key: 'front', layout: COURSE_C, layoutCount: 1, expected: 'Front' },
  { label: 'a course with no code in a multi-course club', key: 'front', layout: BACK_COURSE, layoutCount: 2, expected: 'Front' },
  { label: 'a course that is not split', key: 'all', layout: COURSE_C, layoutCount: 3, expected: null },
]

// Course totals
export const NINE_TOTAL_CASES = NINES.map((nine, index) => ({
  code: nine.code,
  layout: THREE_NINES[index],
  expected: nine.expectedTotals,
}))
export const COURSE_A_SUMMARY = { holeCount: 9, par: 36, totalYardage: 3514 }
export const EMPTY_LAYOUT_SUMMARY = { holeCount: 0, par: 0, totalYardage: null }

export const NO_YARDAGE_LAYOUT = makeLayout({
  name: 'No yardages',
  code: 'N',
  holes: [makeHole('N', 1, 4, null), makeHole('N', 2, 4), makeHole('N', 3, 4, null)],
})
export const NO_YARDAGE_TOTALS_TEXT = 'Par 12'

// One null, one missing entirely, and two with a yardage
export const PARTIAL_YARDAGE_LAYOUT = makeLayout({
  name: 'Some yardages',
  code: 'P',
  holes: [makeHole('P', 1, 4, 380), makeHole('P', 2, 4, null), makeHole('P', 3, 4), makeHole('P', 4, 4, 510)],
})
export const PARTIAL_YARDAGE_TOTAL = 890
export const PARTIAL_YARDAGE_TOTALS_TEXT = 'Par 16 · 890 yds'

export const EMPTY_LAYOUT = makeLayout({ name: 'Empty', code: 'E', holes: [] })

// A course from a response that has no holes field at all
export const LAYOUT_WITHOUT_HOLES_FIELD = {
  id: 'layout-X',
  name: 'Course X',
  code: 'X',
  front_hole_count: 5,
}

export const NO_AMENITIES_CASES = [
  { label: 'null', amenities: null },
  { label: 'undefined', amenities: undefined },
  { label: 'an empty list', amenities: [] },
]
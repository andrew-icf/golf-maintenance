import {
  COURSE_C,
  HOLE_C7,
  MAIN_COURSE,
  NINES,
  holeIdOf,
  makeAmenity,
  makeHole,
  makeNine,
} from './course'

// "C1" to "C5", or "Hole 1" to "Hole 9": the labels a run of holes carries on screen
function numberedLabels(prefix, first, last) {
  return Array.from({ length: last - first + 1 }, (unusedItem, index) => `${prefix}${first + index}`)
}

// HoleCard: what a card says for each way the yardage can arrive. `cardLabel` is the label
// the card is given, and `expected` is every piece of text it shows, in order.
export const HOLE_CARD_CASES = [
  { label: 'a yardage', cardLabel: 'A1', hole: makeHole('A', 1, 4, 380), expected: ['A1', 'Par 4', '380 yds'] },
  { label: 'a yardage of null', cardLabel: 'A2', hole: makeHole('A', 2, 3, null), expected: ['A2', 'Par 3'] },
  { label: 'no yardage field at all', cardLabel: 'A3', hole: makeHole('A', 3, 5), expected: ['A3', 'Par 5'] },
  {
    label: 'a yardage of zero, shown rather than dropped',
    cardLabel: 'A4',
    hole: makeHole('A', 4, 4, 0),
    expected: ['A4', 'Par 4', '0 yds'],
  },
  {
    label: 'a plain hole label, as a club with one course shows',
    cardLabel: 'Hole 7',
    hole: HOLE_C7,
    expected: ['Hole 7', 'Par 3', '210 yds'],
  },
  {
    label: 'a two-digit hole label',
    cardLabel: 'M12',
    hole: MAIN_COURSE.holes[11],
    expected: ['M12', 'Par 4', '400 yds'],
  },
]

// An amenity whose name contains markup, used to check names are shown as text
export const MARKUP_NAME = '<b>Pool</b>'
export const MARKUP_AMENITY = makeAmenity('amenity-8', MARKUP_NAME, null, holeIdOf('C', 7))

// LayoutSection: a split course, with the title, group titles, ranges, and labels it should show
export const FRONT_BACK_SECTION_CASES = [
  {
    label: 'a coded course in a multi-course club',
    layout: COURSE_C,
    layoutCount: 3,
    title: 'Course C',
    groups: [
      { title: 'Front C', range: 'C1–C5', labels: numberedLabels('C', 1, 5) },
      { title: 'Back C', range: 'C6–C9', labels: numberedLabels('C', 6, 9) },
    ],
  },
  {
    label: 'the one 18-hole course of a club',
    layout: MAIN_COURSE,
    layoutCount: 1,
    title: 'Holes',
    groups: [
      { title: 'Front', range: '1–9', labels: numberedLabels('Hole ', 1, 9) },
      { title: 'Back', range: '10–18', labels: numberedLabels('Hole ', 10, 18) },
    ],
  },
]

// A nine with no front count, so it isn't split
export const UNSPLIT_NINE = makeNine(NINES[0], 0, null)
export const UNSPLIT_NINE_LABELS = numberedLabels('A', 1, 9)

// HoleCard: the page each card opens
export const HOLE_LINK_CASES = [
  { label: 'a first hole', cardLabel: 'A1', hole: makeHole('A', 1, 4, 380), path: '/course/holes/hole-A1' },
  { label: 'a back hole', cardLabel: 'C7', hole: HOLE_C7, path: '/course/holes/hole-C7' },
  {
    label: 'a hole whose id needs encoding',
    cardLabel: 'A2',
    hole: { ...makeHole('A', 2, 3, 168), id: 'hole with/odd?id' },
    path: '/course/holes/hole%20with%2Fodd%3Fid',
  },
]
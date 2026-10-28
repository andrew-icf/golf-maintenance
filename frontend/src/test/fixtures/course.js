// Test data about a golf club, shared by every suite that needs one. The real course is a
// club with three nines (A, B, and C), so that is the main example.

export const COURSE_NAME = 'Naboo Meadows Golf Club'
export const DEFAULT_PAR = 4
export const DEFAULT_YARDAGE = 400
export const FRONT_HOLE_COUNT = 5

// The real holes of a three-nine club, one entry per course
export const NINES = [
  {
    code: 'A',
    pars: [4, 5, 3, 4, 3, 4, 4, 5, 4],
    yardages: [409, 518, 168, 452, 191, 363, 418, 543, 452],
    expectedTotals: 'Par 36 · 3,514 yds',
  },
  {
    code: 'B',
    pars: [4, 4, 5, 3, 4, 5, 3, 4, 4],
    yardages: [395, 455, 567, 164, 418, 546, 189, 426, 440],
    expectedTotals: 'Par 36 · 3,600 yds',
  },
  {
    code: 'C',
    pars: [4, 4, 3, 4, 4, 5, 3, 4, 5],
    yardages: [481, 459, 174, 405, 398, 532, 210, 458, 532],
    expectedTotals: 'Par 36 · 3,649 yds',
  },
]
export const THREE_NINE_HOLE_COUNT = 27
export const THREE_NINE_TOTAL_YARDAGE = 10763
export const HOLES_IN_MAIN_COURSE = 18

// Builders

export function holeIdOf(prefix, number) {
  return `hole-${prefix}${number}`
}

// A hole. Leave yardage out (undefined) for a hole whose yardage field is missing entirely,
// or pass null for a hole whose yardage is empty.
export function makeHole(prefix, number, par, yardage) {
  const hole = { id: holeIdOf(prefix, number), hole_number: number, par }
  return yardage === undefined ? hole : { ...hole, yardage }
}

export function makeNumberedHoles(prefix, count) {
  return Array.from({ length: count }, (unusedItem, index) =>
    makeHole(prefix, index + 1, DEFAULT_PAR, DEFAULT_YARDAGE)
  )
}

export function makeLayout({ name, code = null, position = 1, frontHoleCount = null, holes }) {
  return {
    id: `layout-${name}`,
    name,
    code,
    position,
    front_hole_count: frontHoleCount,
    holes,
  }
}

// One of the real nines above, as the server sends it
export function makeNine(nine, index, frontHoleCount = FRONT_HOLE_COUNT) {
  return makeLayout({
    name: `Course ${nine.code}`,
    code: nine.code,
    position: index + 1,
    frontHoleCount,
    holes: nine.pars.map((par, holeIndex) =>
      makeHole(nine.code, holeIndex + 1, par, nine.yardages[holeIndex])
    ),
  })
}

// Courses of the given sizes, named and lettered A, B, C... in play order, with numbered holes
export function makeClubLayouts(sizes) {
  return sizes.map((size, index) => {
    const code = String.fromCharCode(65 + index)
    return makeLayout({
      name: `Course ${code}`,
      code,
      position: index + 1,
      holes: makeNumberedHoles(code, size),
    })
  })
}

// What /api/course sends. The server also sends a flat list of every hole beside the courses.
export function makeCourseResponse(layouts, { name = COURSE_NAME, flatHoles = [] } = {}) {
  return { id: 'course-1', name, layouts, holes: flatHoles, amenities: [] }
}

export function makeClubResponse(sizes) {
  return makeCourseResponse(makeClubLayouts(sizes))
}

// The real club, built

export const THREE_NINES = NINES.map((nine, index) => makeNine(nine, index))
export const COURSE_A = THREE_NINES[0]
export const COURSE_C = THREE_NINES[2]
export const HOLE_C7 = COURSE_C.holes[6]
export const THREE_NINE_COURSE = makeCourseResponse(THREE_NINES)

// A club with one 18-hole course that has no code, and a course with no code in a club of two
export const MAIN_COURSE = makeLayout({
  name: 'Main',
  frontHoleCount: 9,
  holes: makeNumberedHoles('M', HOLES_IN_MAIN_COURSE),
})
export const BACK_COURSE = makeLayout({
  name: 'Back Course',
  position: 2,
  holes: makeNumberedHoles('K', 9),
})

// Club shapes that exist in the real world, so nothing is tied to 18 holes
export const CLUB_SHAPES = [
  { label: 'a single hole', sizes: [1] },
  { label: 'a six-hole course', sizes: [6] },
  { label: 'a nine-hole club', sizes: [9] },
  { label: 'a twelve-hole course', sizes: [12] },
  { label: 'an 18-hole club as one course', sizes: [18] },
  { label: 'an 18-hole club as two nines', sizes: [9, 9] },
  { label: 'a nine and a six', sizes: [9, 6] },
  { label: 'three nines', sizes: [9, 9, 9] },
  { label: 'two 18-hole courses', sizes: [18, 18] },
  { label: 'four nines', sizes: [9, 9, 9, 9] },
]

// Amenities. A hole of undefined leaves the hole_id key out; null means "no hole".
export function makeAmenity(id, name, type, holeId) {
  const amenity = { id, name, type }
  return holeId === undefined ? amenity : { ...amenity, hole_id: holeId }
}

export const COMFORT_A5 = makeAmenity('amenity-1', 'Comfort Station A5', 'comfort_station', holeIdOf('A', 5))
export const COMFORT_B6 = makeAmenity('amenity-2', 'Comfort Station B6', 'comfort_station', holeIdOf('B', 6))
export const COMFORT_C7 = makeAmenity('amenity-3', 'Comfort Station C7', 'comfort_station', holeIdOf('C', 7))
export const CLUBHOUSE = makeAmenity('amenity-4', 'Clubhouse', 'clubhouse', null)
export const DRIVING_RANGE = makeAmenity('amenity-5', 'Driving Range', 'driving_range')
export const WATER_COOLER_C7 = makeAmenity('amenity-6', 'Water Cooler', 'water_cooler', holeIdOf('C', 7))
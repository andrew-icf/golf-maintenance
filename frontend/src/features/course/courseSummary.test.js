import { describe, expect, it } from 'vitest'
import { formatHoleCount, formatYardage, summarizeCourse } from './courseSummary'

// Test data
const COURSE_NAME = 'Naboo Meadows Golf Club'
const EVERY_HOLE_YARDAGE = 400

function makeHoles(count) {
  return Array.from({ length: count }, (unusedItem, index) => ({
    id: `hole-${index + 1}`,
    hole_number: index + 1,
    par: 4,
    yardage: EVERY_HOLE_YARDAGE,
  }))
}

function makeCourse(holes) {
  return { id: 'course-1', name: COURSE_NAME, holes, amenities: [] }
}

const HOLE_COUNT_CASES = [
  { label: 'a course with no holes yet', count: 0 },
  { label: 'a single hole', count: 1 },
  { label: 'a nine-hole course', count: 9 },
  { label: 'an eighteen-hole course', count: 18 },
  { label: 'three nines', count: 27 },
  { label: 'two eighteens', count: 36 },
]

const VARIED_HOLES = [380, 165, 510, 400, 365].map((yardage, index) => ({
  id: `varied-${index + 1}`,
  hole_number: index + 1,
  par: 4,
  yardage,
}))
const VARIED_TOTAL = 1820

// Two holes with no yardage: one null, one with the field missing entirely
const PARTIAL_HOLES = [
  { id: 'a', hole_number: 1, par: 4, yardage: 380 },
  { id: 'b', hole_number: 2, par: 3, yardage: null },
  { id: 'c', hole_number: 3, par: 5, yardage: 510 },
  { id: 'd', hole_number: 4, par: 4 },
]
const PARTIAL_TOTAL = 890
const PARTIAL_MISSING_COUNT = 2

const NO_YARDAGE_HOLES = [
  { id: 'a', hole_number: 1, par: 4, yardage: null },
  { id: 'b', hole_number: 2, par: 3, yardage: null },
  { id: 'c', hole_number: 3, par: 5 },
]

// What the sidebar passes before the course has loaded, or if the response has no holes
const EMPTY_INPUT_CASES = [
  { label: 'null', course: null },
  { label: 'undefined', course: undefined },
  { label: 'a course with no holes field', course: { name: COURSE_NAME } },
]
const EMPTY_SUMMARY_FOR_UNNAMED = { name: '', holeCount: 0, totalYardage: null, holesMissingYardage: 0 }

const HOLE_COUNT_TEXT_CASES = [
  { count: 0, expected: '0 holes' },
  { count: 1, expected: '1 hole' },
  { count: 2, expected: '2 holes' },
  { count: 18, expected: '18 holes' },
  { count: 27, expected: '27 holes' },
]

const YARDAGE_TEXT_CASES = [
  { label: 'no total', total: null, expected: '—' },
  { label: 'zero', total: 0, expected: '0 yds' },
  { label: 'three digits, with no separator', total: 999, expected: '999 yds' },
  { label: 'a typical total', total: 6680, expected: '6,680 yds' },
  { label: 'exactly ten thousand', total: 10000, expected: '10,000 yds' },
  { label: 'a larger total', total: 12345, expected: '12,345 yds' },
]

describe('summarizeCourse', () => {
  it('passes the course name through', () => {
    expect(summarizeCourse(makeCourse(makeHoles(9))).name).toBe(COURSE_NAME)
  })

  it.each(HOLE_COUNT_CASES)('counts the holes and totals the yardage for $label', ({ count }) => {
    const summary = summarizeCourse(makeCourse(makeHoles(count)))

    expect(summary.holeCount).toBe(count)
    expect(summary.totalYardage).toBe(count === 0 ? null : count * EVERY_HOLE_YARDAGE)
    expect(summary.holesMissingYardage).toBe(0)
  })

  it('adds up different yardages', () => {
    expect(summarizeCourse(makeCourse(VARIED_HOLES)).totalYardage).toBe(VARIED_TOTAL)
  })

  it('skips holes without a yardage and reports how many it skipped', () => {
    const summary = summarizeCourse(makeCourse(PARTIAL_HOLES))

    expect(summary.holeCount).toBe(PARTIAL_HOLES.length)
    expect(summary.totalYardage).toBe(PARTIAL_TOTAL)
    expect(summary.holesMissingYardage).toBe(PARTIAL_MISSING_COUNT)
  })

  it('has no total when no hole has a yardage', () => {
    const summary = summarizeCourse(makeCourse(NO_YARDAGE_HOLES))

    expect(summary.totalYardage).toBeNull()
    expect(summary.holesMissingYardage).toBe(NO_YARDAGE_HOLES.length)
    expect(summary.holeCount).toBe(NO_YARDAGE_HOLES.length)
  })

  it.each(EMPTY_INPUT_CASES)('returns empty defaults for $label', ({ course }) => {
    const summary = summarizeCourse(course)

    expect(summary).toEqual({
      ...EMPTY_SUMMARY_FOR_UNNAMED,
      name: course?.name ?? '',
    })
  })

  it('does not modify the course it is given', () => {
    const frozenCourse = Object.freeze({
      ...makeCourse(Object.freeze(makeHoles(3))),
    })

    expect(() => summarizeCourse(frozenCourse)).not.toThrow()
  })
})

describe('formatHoleCount', () => {
  it.each(HOLE_COUNT_TEXT_CASES)('writes $count as "$expected"', ({ count, expected }) => {
    expect(formatHoleCount(count)).toBe(expected)
  })
})

describe('formatYardage', () => {
  it.each(YARDAGE_TEXT_CASES)('formats $label', ({ total, expected }) => {
    expect(formatYardage(total)).toBe(expected)
  })
})
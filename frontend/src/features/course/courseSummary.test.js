import { describe, expect, it } from 'vitest'
import {
  CLUB_SHAPES,
  COURSE_NAME,
  DEFAULT_YARDAGE,
  NINES,
  THREE_NINE_COURSE,
  THREE_NINE_HOLE_COUNT,
  THREE_NINE_TOTAL_YARDAGE,
  makeClubResponse,
} from '../../test/fixtures/course'
import {
  COURSE_SIZE_CASES,
  EMPTY_INPUT_CASES,
  FLAT_LIST_COURSE,
  FLAT_LIST_HOLE_COUNT,
  FROZEN_COURSE,
  HOLE_COUNT_TEXT_CASES,
  NO_YARDAGE_COURSE,
  NO_YARDAGE_HOLE_COUNT,
  PARTIAL_COURSE,
  PARTIAL_HOLE_COUNT,
  PARTIAL_MISSING_COUNT,
  PARTIAL_TOTAL,
  YARDAGE_TEXT_CASES,
} from '../../test/fixtures/courseSummaryCases'
import {
  formatCourseSize,
  formatHoleCount,
  formatYardage,
  summarizeCourse,
} from './courseSummary'

describe('summarizeCourse', () => {
  it('passes the course name through', () => {
    expect(summarizeCourse(makeClubResponse([9])).name).toBe(COURSE_NAME)
  })

  it.each(CLUB_SHAPES)('counts the courses, holes, and yardage for $label', ({ sizes }) => {
    const summary = summarizeCourse(makeClubResponse(sizes))
    const expectedHoleCount = sizes.reduce((total, size) => total + size, 0)

    expect(summary.layoutCount).toBe(sizes.length)
    expect(summary.holeCount).toBe(expectedHoleCount)
    expect(summary.totalYardage).toBe(expectedHoleCount * DEFAULT_YARDAGE)
    expect(summary.holesMissingYardage).toBe(0)
  })

  it('adds up the real yardages of a three-nine club', () => {
    const summary = summarizeCourse(THREE_NINE_COURSE)

    expect(summary.layoutCount).toBe(NINES.length)
    expect(summary.holeCount).toBe(THREE_NINE_HOLE_COUNT)
    expect(summary.totalYardage).toBe(THREE_NINE_TOTAL_YARDAGE)
  })

  it('skips holes without a yardage and reports how many it skipped', () => {
    const summary = summarizeCourse(PARTIAL_COURSE)

    expect(summary.holeCount).toBe(PARTIAL_HOLE_COUNT)
    expect(summary.totalYardage).toBe(PARTIAL_TOTAL)
    expect(summary.holesMissingYardage).toBe(PARTIAL_MISSING_COUNT)
  })

  it('has no total when no hole has a yardage', () => {
    const summary = summarizeCourse(NO_YARDAGE_COURSE)

    expect(summary.totalYardage).toBeNull()
    expect(summary.holesMissingYardage).toBe(NO_YARDAGE_HOLE_COUNT)
    expect(summary.holeCount).toBe(NO_YARDAGE_HOLE_COUNT)
  })

  it.each(EMPTY_INPUT_CASES)('returns safe defaults for $label', ({ course, expected }) => {
    expect(summarizeCourse(course)).toEqual(expected)
  })

  it('counts the holes inside the courses, not the flat list the server also sends', () => {
    const summary = summarizeCourse(FLAT_LIST_COURSE)

    expect(summary.holeCount).toBe(FLAT_LIST_HOLE_COUNT)
    expect(summary.totalYardage).toBe(FLAT_LIST_HOLE_COUNT * DEFAULT_YARDAGE)
  })

  it('does not modify the course it is given', () => {
    expect(() => summarizeCourse(FROZEN_COURSE)).not.toThrow()
  })
})

describe('formatHoleCount', () => {
  it.each(HOLE_COUNT_TEXT_CASES)('writes $count as "$expected"', ({ count, expected }) => {
    expect(formatHoleCount(count)).toBe(expected)
  })
})

describe('formatCourseSize', () => {
  it.each(COURSE_SIZE_CASES)('writes $label as "$expected"', ({ holeCount, layoutCount, expected }) => {
    expect(formatCourseSize({ holeCount, layoutCount })).toBe(expected)
  })
})

describe('formatYardage', () => {
  it.each(YARDAGE_TEXT_CASES)('formats $label', ({ total, expected }) => {
    expect(formatYardage(total)).toBe(expected)
  })
})
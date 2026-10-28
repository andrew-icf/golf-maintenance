import { describe, expect, it } from 'vitest'
import {
  BACK_COURSE,
  CLUBHOUSE,
  COMFORT_A5,
  COMFORT_B6,
  COMFORT_C7,
  COURSE_A,
  DRIVING_RANGE,
  HOLES_IN_MAIN_COURSE,
  MAIN_COURSE,
  THREE_NINE_HOLE_COUNT,
  THREE_NINES,
  WATER_COOLER_C7,
  holeIdOf,
} from '../../test/fixtures/course'
import {
  COURSE_A_SUMMARY,
  EMPTY_LAYOUT,
  EMPTY_LAYOUT_SUMMARY,
  FROZEN_LAYOUT,
  GROUP_TITLE_CASES,
  LABEL_CASES,
  LAYOUT_WITHOUT_HOLES_FIELD,
  NINE_TOTAL_CASES,
  NO_AMENITIES_CASES,
  NO_SPLIT_CASES,
  NO_YARDAGE_LAYOUT,
  NO_YARDAGE_TOTALS_TEXT,
  PARTIAL_YARDAGE_LAYOUT,
  PARTIAL_YARDAGE_TOTAL,
  PARTIAL_YARDAGE_TOTALS_TEXT,
  RANGE_CASES,
  SHUFFLED_BACK,
  SHUFFLED_FRONT,
  SHUFFLED_LAYOUT,
  SPLIT_CASES,
} from '../../test/fixtures/courseLayoutCases'
import {
  buildHoleLabels,
  formatGroupTitle,
  formatHoleLabel,
  formatHoleRange,
  formatLayoutTotals,
  groupAmenitiesByHole,
  splitFrontBack,
  summarizeLayout,
} from './courseLayout'

function holeNumbers(holes) {
  return holes.map((hole) => hole.hole_number)
}

describe('formatHoleLabel', () => {
  it.each(LABEL_CASES)('writes $label as "$expected"', ({ layout, hole, layoutCount, expected }) => {
    expect(formatHoleLabel(layout, hole, layoutCount)).toBe(expected)
  })
})

describe('formatHoleRange', () => {
  it.each(RANGE_CASES)('writes $label as "$expected"', ({ layout, holes, layoutCount, expected }) => {
    expect(formatHoleRange(layout, holes, layoutCount)).toBe(expected)
  })
})

describe('splitFrontBack', () => {
  it.each(SPLIT_CASES)('splits $label into front and back', ({ layout, front, back }) => {
    const groups = splitFrontBack(layout)

    expect(groups.map((group) => group.key)).toEqual(['front', 'back'])
    expect(holeNumbers(groups[0].holes)).toEqual(front)
    expect(holeNumbers(groups[1].holes)).toEqual(back)
  })

  it.each(NO_SPLIT_CASES)('does not split $label', ({ layout }) => {
    expect(splitFrontBack(layout)).toEqual([{ key: 'all', holes: layout.holes }])
  })

  it('does not split a course that has no holes field', () => {
    expect(splitFrontBack(LAYOUT_WITHOUT_HOLES_FIELD)).toEqual([{ key: 'all', holes: [] }])
  })

  it('keeps the holes in the order it was given', () => {
    const groups = splitFrontBack(SHUFFLED_LAYOUT)

    expect(holeNumbers(groups[0].holes)).toEqual(SHUFFLED_FRONT)
    expect(holeNumbers(groups[1].holes)).toEqual(SHUFFLED_BACK)
  })

  it('does not modify the course it is given', () => {
    expect(() => splitFrontBack(FROZEN_LAYOUT)).not.toThrow()
  })
})

describe('formatGroupTitle', () => {
  it.each(GROUP_TITLE_CASES)('titles $label', ({ layout, key, layoutCount, expected }) => {
    expect(formatGroupTitle(layout, key, layoutCount)).toBe(expected)
  })
})

describe('course totals', () => {
  it.each(NINE_TOTAL_CASES)('shows the real totals for course $code', ({ layout, expected }) => {
    expect(formatLayoutTotals(summarizeLayout(layout))).toBe(expected)
  })

  it('counts the holes, par, and yardage of a course', () => {
    expect(summarizeLayout(COURSE_A)).toEqual(COURSE_A_SUMMARY)
  })

  it('shows only the par when no hole has a yardage', () => {
    expect(summarizeLayout(NO_YARDAGE_LAYOUT).totalYardage).toBeNull()
    expect(formatLayoutTotals(summarizeLayout(NO_YARDAGE_LAYOUT))).toBe(NO_YARDAGE_TOTALS_TEXT)
  })

  it('adds up only the yardages that exist', () => {
    expect(summarizeLayout(PARTIAL_YARDAGE_LAYOUT).totalYardage).toBe(PARTIAL_YARDAGE_TOTAL)
    expect(formatLayoutTotals(summarizeLayout(PARTIAL_YARDAGE_LAYOUT))).toBe(PARTIAL_YARDAGE_TOTALS_TEXT)
  })

  it('shows nothing for a course with no holes yet', () => {
    expect(summarizeLayout(EMPTY_LAYOUT)).toEqual(EMPTY_LAYOUT_SUMMARY)
    expect(formatLayoutTotals(summarizeLayout(EMPTY_LAYOUT))).toBe('')
  })

  it('treats a course with no holes field as having no holes', () => {
    expect(summarizeLayout(LAYOUT_WITHOUT_HOLES_FIELD)).toEqual(EMPTY_LAYOUT_SUMMARY)
  })
})

describe('groupAmenitiesByHole', () => {
  it('groups amenities under the hole they sit on and leaves out the rest', () => {
    const amenitiesByHole = groupAmenitiesByHole([COMFORT_A5, CLUBHOUSE, COMFORT_B6, DRIVING_RANGE, COMFORT_C7])
    const groupedAmenities = [...amenitiesByHole.values()].flat()

    expect(amenitiesByHole.size).toBe(3)
    expect(amenitiesByHole.get(holeIdOf('A', 5))).toEqual([COMFORT_A5])
    expect(amenitiesByHole.get(holeIdOf('B', 6))).toEqual([COMFORT_B6])
    expect(amenitiesByHole.get(holeIdOf('C', 7))).toEqual([COMFORT_C7])
    expect(groupedAmenities).not.toContain(CLUBHOUSE)
    expect(groupedAmenities).not.toContain(DRIVING_RANGE)
  })

  it('keeps several amenities on one hole in the order they were given', () => {
    const amenitiesByHole = groupAmenitiesByHole([COMFORT_C7, WATER_COOLER_C7])

    expect(amenitiesByHole.get(holeIdOf('C', 7))).toEqual([COMFORT_C7, WATER_COOLER_C7])
  })

  it.each(NO_AMENITIES_CASES)('returns nothing for $label', ({ amenities }) => {
    expect(groupAmenitiesByHole(amenities).size).toBe(0)
  })
})

describe('buildHoleLabels', () => {
  it('labels every hole of a three-nine club with its course letter', () => {
    const labels = buildHoleLabels(THREE_NINES)

    expect(labels.size).toBe(THREE_NINE_HOLE_COUNT)
    expect(labels.get(holeIdOf('A', 1))).toBe('A1')
    expect(labels.get(holeIdOf('B', 6))).toBe('B6')
    expect(labels.get(holeIdOf('C', 7))).toBe('C7')
  })

  it('labels the holes of a club with one course as plain holes', () => {
    const labels = buildHoleLabels([MAIN_COURSE])

    expect(labels.size).toBe(HOLES_IN_MAIN_COURSE)
    expect(labels.get(holeIdOf('M', 7))).toBe('Hole 7')
  })

  it('uses the course name for a course with no code in a multi-course club', () => {
    const labels = buildHoleLabels([COURSE_A, BACK_COURSE])

    expect(labels.get(holeIdOf('K', 4))).toBe('Back Course 4')
    expect(labels.get(holeIdOf('A', 4))).toBe('A4')
  })

  it('has no labels when there are no courses', () => {
    expect(buildHoleLabels([]).size).toBe(0)
  })

  it('skips a course that has no holes field', () => {
    expect(buildHoleLabels([LAYOUT_WITHOUT_HOLES_FIELD]).size).toBe(0)
  })
})
import { describe, expect, it } from 'vitest'
import { CLUBHOUSE, NINES, THREE_NINES, holeIdOf } from '../../test/fixtures/course'
import { THREE_NINE_PAGE } from '../../test/fixtures/coursePageCases'
import {
  AMENITY_CASES,
  FROZEN_PAGE,
  HOLE_DETAILS_CASES,
  MISSING_COURSE_CASES,
  MISSING_ID_CASES,
  MULTI_AMENITY_PAGE,
  NOT_FOUND_CASES,
  YARDAGE_CASES,
  YARDAGE_PAGE,
} from '../../test/fixtures/holeDetailsCases'
import { findHoleDetails } from './holeDetails'

describe('findHoleDetails', () => {
  it.each(HOLE_DETAILS_CASES)('describes $label', ({ course, holeId, expected }) => {
    expect(findHoleDetails(course, holeId)).toMatchObject(expected)
  })

  it('finds every hole of the three-nine club, each under its own course letter', () => {
    for (const nine of NINES) {
      for (let holeNumber = 1; holeNumber <= nine.pars.length; holeNumber++) {
        const details = findHoleDetails(THREE_NINE_PAGE, holeIdOf(nine.code, holeNumber))

        expect(details, `${nine.code}${holeNumber}`).not.toBeNull()
        expect(details.label).toBe(`${nine.code}${holeNumber}`)
        expect(details.par).toBe(nine.pars[holeNumber - 1])
        expect(details.yardage).toBe(nine.yardages[holeNumber - 1])
      }
    }
  })

  it.each(YARDAGE_CASES)('reports $label', ({ holeId, expected }) => {
    expect(findHoleDetails(YARDAGE_PAGE, holeId).yardage).toBe(expected)
  })

  it.each(AMENITY_CASES)('lists the amenities of $label', ({ holeId, expected }) => {
    const details = findHoleDetails(MULTI_AMENITY_PAGE, holeId)

    expect(details.amenities.map((amenity) => amenity.id)).toEqual(expected)
  })

  it('never lists a club-level amenity on any hole', () => {
    for (const layout of THREE_NINES) {
      for (const hole of layout.holes) {
        const details = findHoleDetails(MULTI_AMENITY_PAGE, hole.id)

        expect(details.amenities).not.toContain(CLUBHOUSE)
      }
    }
  })

  it.each(NOT_FOUND_CASES)('finds nothing for $label', ({ course, holeId }) => {
    expect(findHoleDetails(course, holeId)).toBeNull()
  })

  it.each(MISSING_ID_CASES)('finds nothing for $label', ({ holeId }) => {
    expect(findHoleDetails(THREE_NINE_PAGE, holeId)).toBeNull()
  })

  it.each(MISSING_COURSE_CASES)('finds nothing when the course is $label', ({ course }) => {
    expect(findHoleDetails(course, holeIdOf('A', 1))).toBeNull()
  })

  it('does not modify the course it is given', () => {
    expect(() => findHoleDetails(FROZEN_PAGE, holeIdOf('C', 7))).not.toThrow()
  })
})
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NO_AMENITIES_CASES } from '../../test/fixtures/courseLayoutCases'
import { MARKUP_AMENITY, MARKUP_NAME } from '../../test/fixtures/courseViewCases'
import {
  AMENITIES_IN_SERVER_ORDER,
  AMENITY_ROW_CASES,
  MAIN_COURSE_HOLE_LABELS,
  MAIN_COURSE_STATION,
  ORPHAN_AMENITY,
  THREE_NINE_HOLE_LABELS,
} from '../../test/fixtures/coursePageCases'
import { AmenityList } from './AmenityList'

const NO_AMENITIES_TEXT = 'No amenities yet.'

// Actions
function renderList(props) {
  return render(<AmenityList holeLabels={ THREE_NINE_HOLE_LABELS } { ...props } />)
}

function locationOf(row) {
  return row.querySelector('.amenity-location')?.textContent ?? null
}

describe('AmenityList', () => {
  it('titles the section "Amenities"', () => {
    renderList({ amenities: AMENITIES_IN_SERVER_ORDER })

    expect(screen.getByRole('heading', { level: 2, name: 'Amenities' })).toBeInTheDocument()
  })

  it('lists each amenity as one item, in the order given', () => {
    renderList({ amenities: AMENITIES_IN_SERVER_ORDER })

    const rows = screen.getAllByRole('listitem')

    expect(rows.map((row) => row.querySelector('.amenity-name').textContent)).toEqual(
      AMENITY_ROW_CASES.map((row) => row.name)
    )
  })

  it.each(AMENITY_ROW_CASES)('shows $name with its location, $location', ({ name, location }) => {
    renderList({ amenities: AMENITIES_IN_SERVER_ORDER })

    expect(locationOf(screen.getByText(name).closest('li'))).toBe(location)
  })

  it('uses the hole label the club gives, so a club with one course says "On Hole 7"', () => {
    renderList({ amenities: [MAIN_COURSE_STATION], holeLabels: MAIN_COURSE_HOLE_LABELS })

    expect(locationOf(screen.getByText(MAIN_COURSE_STATION.name).closest('li'))).toBe('On Hole 7')
  })

  it('says nothing about a hole it has no label for', () => {
    renderList({ amenities: [ORPHAN_AMENITY] })

    expect(screen.getByText(ORPHAN_AMENITY.name)).toBeInTheDocument()
    expect(locationOf(screen.getByText(ORPHAN_AMENITY.name).closest('li'))).toBeNull()
  })

  it('says nothing about locations when no hole labels are given', () => {
    const { container } = render(<AmenityList amenities={ AMENITIES_IN_SERVER_ORDER } />)

    expect(container.querySelector('.amenity-location')).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(AMENITIES_IN_SERVER_ORDER.length)
  })

  it.each(NO_AMENITIES_CASES)('says so when given $label', ({ amenities }) => {
    renderList({ amenities })

    expect(screen.getByText(NO_AMENITIES_TEXT)).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('shows an amenity name as text, never as markup', () => {
    const { container } = renderList({ amenities: [MARKUP_AMENITY] })

    expect(screen.getByText(MARKUP_NAME)).toBeInTheDocument()
    expect(container.querySelector('b')).toBeNull()
  })
})
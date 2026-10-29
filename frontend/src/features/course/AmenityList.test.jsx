import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NO_AMENITIES_CASES } from '../../test/fixtures/courseLayoutCases'
import { MARKUP_AMENITY, MARKUP_NAME } from '../../test/fixtures/courseViewCases'
import {
  AMENITIES_IN_SERVER_ORDER,
  AMENITY_LINK_CASES,
  AMENITY_ROW_CASES,
  CLUB_LEVEL_AMENITY_NAMES,
  MAIN_COURSE_HOLE_LABELS,
  MAIN_COURSE_STATION,
  ORPHAN_AMENITY,
  THREE_NINE_HOLE_LABELS,
} from '../../test/fixtures/coursePageCases'
import { AmenityList } from './AmenityList'
import { HOLE_ROUTE_PATTERN } from '../hole/holePath'

// Test data
const NO_AMENITIES_TEXT = 'No amenities yet.'
const COURSE_LIST_PATH = '/course'
const DETAILS_PAGE_TEXT = 'Hole details page'

// Actions
function renderList(props) {
  return render(
    <MemoryRouter initialEntries={ [COURSE_LIST_PATH] }>
      <Routes>
        <Route
          path={ COURSE_LIST_PATH }
          element={ <AmenityList holeLabels={ THREE_NINE_HOLE_LABELS } { ...props } /> }
        />
        <Route path={ HOLE_ROUTE_PATTERN } element={ <p>{ DETAILS_PAGE_TEXT }</p> } />
      </Routes>
    </MemoryRouter>
  )
}

function locationOf(row) {
  return row.querySelector('.amenity-location')?.textContent ?? null
}

function rowNamed(name) {
  return screen.getByText(name).closest('li')
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

    expect(locationOf(rowNamed(name))).toBe(location)
  })

  it('uses the hole label the club gives, so a club with one course says "On Hole 7"', () => {
    renderList({ amenities: [MAIN_COURSE_STATION], holeLabels: MAIN_COURSE_HOLE_LABELS })

    expect(locationOf(rowNamed(MAIN_COURSE_STATION.name))).toBe('On Hole 7')
  })

  it('says nothing about a hole it has no label for, and links nowhere', () => {
    renderList({ amenities: [ORPHAN_AMENITY] })

    expect(screen.getByText(ORPHAN_AMENITY.name)).toBeInTheDocument()
    expect(locationOf(rowNamed(ORPHAN_AMENITY.name))).toBeNull()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
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

  describe('opening a hole', () => {
    it.each(AMENITY_LINK_CASES)('links $name to the page of hole $holeLabel', ({ name, path }) => {
      renderList({ amenities: AMENITIES_IN_SERVER_ORDER })

      expect(within(rowNamed(name)).getByRole('link')).toHaveAttribute('href', path)
    })

    it('does not link an amenity that belongs to the whole club', () => {
      renderList({ amenities: AMENITIES_IN_SERVER_ORDER })

      for (const name of CLUB_LEVEL_AMENITY_NAMES) {
        expect(within(rowNamed(name)).queryByRole('link')).not.toBeInTheDocument()
      }
    })

    it("opens the hole's details page when the location is used", async () => {
      renderList({ amenities: AMENITIES_IN_SERVER_ORDER })

      await userEvent.click(screen.getByRole('link', { name: 'On C7' }))

      expect(screen.getByText(DETAILS_PAGE_TEXT)).toBeInTheDocument()
      expect(screen.queryByText('Amenities')).not.toBeInTheDocument()
    })
  })
})
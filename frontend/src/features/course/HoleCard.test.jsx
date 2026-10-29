import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HOLE_C7 } from '../../test/fixtures/course'
import { HOLE_CARD_CASES, HOLE_LINK_CASES } from '../../test/fixtures/courseViewCases'
import { HoleCard } from './HoleCard'
import { HOLE_ROUTE_PATTERN } from './holePath'

// Test data
const LONG_LABEL = 'Back Course 12'
const COURSE_LIST_PATH = '/course'
const DETAILS_PAGE_TEXT = 'Hole details page'

// Actions
function renderCard({ cardLabel = 'C7', hole = HOLE_C7 } = {}) {
  return render(
    <MemoryRouter initialEntries={ [COURSE_LIST_PATH] }>
      <Routes>
        <Route
          path={ COURSE_LIST_PATH }
          element={
            <ul>
              <HoleCard label={ cardLabel } hole={ hole } />
            </ul>
          }
        />
        <Route path={ HOLE_ROUTE_PATTERN } element={ <p>{ DETAILS_PAGE_TEXT }</p> } />
      </Routes>
    </MemoryRouter>
  )
}

function textsIn(container, selector) {
  return Array.from(container.querySelectorAll(selector)).map((node) => node.textContent)
}

describe('HoleCard', () => {
  it.each(HOLE_CARD_CASES)('shows a hole with $label', ({ cardLabel, hole, expected }) => {
    const { container } = renderCard({ cardLabel, hole })

    expect(textsIn(container, '.hole-number, .hole-detail')).toEqual(expected)
  })

  it('is one item in a list', () => {
    renderCard()

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('gives the full label as a hover title, for a label too long to fit', () => {
    renderCard({ cardLabel: LONG_LABEL })

    expect(screen.getByText(LONG_LABEL)).toHaveAttribute('title', LONG_LABEL)
  })

  it.each(HOLE_LINK_CASES)('links $label to its own page', ({ cardLabel, hole, path }) => {
    renderCard({ cardLabel, hole })

    expect(screen.getByRole('link')).toHaveAttribute('href', path)
  })

  it("opens the hole's details page when it is used", async () => {
    renderCard()

    await userEvent.click(screen.getByRole('link'))

    expect(screen.getByText(DETAILS_PAGE_TEXT)).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})
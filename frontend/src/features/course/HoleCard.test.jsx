import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HOLE_C7 } from '../../test/fixtures/course'
import { HOLE_CARD_CASES } from '../../test/fixtures/courseViewCases'
import { HoleCard } from './HoleCard'

// Test data
const LONG_LABEL = 'Back Course 12'

// Actions
function renderCard({ cardLabel = 'C7', hole = HOLE_C7 } = {}) {
  return render(
    <ul>
      <HoleCard label={ cardLabel } hole={ hole } />
    </ul>
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
})
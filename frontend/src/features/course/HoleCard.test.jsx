import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HOLE_C7 } from '../../test/fixtures/course'
import {
  AMENITY_CHIP_CASES,
  HOLE_CARD_CASES,
  MARKUP_AMENITY,
  MARKUP_NAME,
  NO_CHIP_CASES,
} from '../../test/fixtures/courseViewCases'
import { HoleCard } from './HoleCard'

// Actions
function renderCard({ cardLabel = 'C7', hole = HOLE_C7, amenities } = {}) {
  return render(
    <ul>
      <HoleCard label={ cardLabel } hole={ hole } amenities={ amenities } />
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

  it.each(AMENITY_CHIP_CASES)('shows $label', ({ amenities, expected }) => {
    const { container } = renderCard({ amenities })

    expect(textsIn(container, '.hole-amenity')).toEqual(expected)
  })

  it.each(NO_CHIP_CASES)('shows no amenities for $label', ({ amenities }) => {
    const { container } = renderCard({ amenities })

    expect(container.querySelector('.hole-amenities')).toBeNull()
  })

  it('shows an amenity name as text, never as markup', () => {
    const { container } = renderCard({ amenities: [MARKUP_AMENITY] })

    expect(screen.getByText(MARKUP_NAME)).toBeInTheDocument()
    expect(container.querySelector('b')).toBeNull()
  })
})
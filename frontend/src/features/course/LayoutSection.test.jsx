import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { CLUB_SHAPES, COURSE_C, MAIN_COURSE, makeClubLayouts } from '../../test/fixtures/course'
import { EMPTY_LAYOUT, NINE_TOTAL_CASES } from '../../test/fixtures/courseLayoutCases'
import {
  AMENITIES_BY_HOLE,
  FRONT_BACK_SECTION_CASES,
  UNSPLIT_NINE,
  UNSPLIT_NINE_LABELS,
} from '../../test/fixtures/courseViewCases'
import { LayoutSection } from './LayoutSection'

// Actions
function renderSection({ layout, layoutCount, amenitiesByHole }) {
  return render(
    <LayoutSection layout={ layout } layoutCount={ layoutCount } amenitiesByHole={ amenitiesByHole } />
  )
}

function textsIn(root, selector) {
  return Array.from(root.querySelectorAll(selector)).map((node) => node.textContent)
}

function levelTwoHeadings() {
  return screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
}

describe('LayoutSection', () => {
  describe('title and totals', () => {
    it('titles the section after the course in a multi-course club', () => {
      renderSection({ layout: COURSE_C, layoutCount: 3 })

      expect(levelTwoHeadings()).toEqual(['Course C'])
    })

    it('calls the only course "Holes" in a club with one course', () => {
      renderSection({ layout: MAIN_COURSE, layoutCount: 1 })

      expect(levelTwoHeadings()).toEqual(['Holes'])
    })

    it.each(NINE_TOTAL_CASES)('shows the real totals for course $code', ({ layout, expected }) => {
      const { container } = renderSection({ layout, layoutCount: 3 })

      expect(textsIn(container, '.layout-totals')).toEqual([expected])
    })

    it('says so, with no totals and no cards, for a course with no holes yet', () => {
      const { container } = renderSection({ layout: EMPTY_LAYOUT, layoutCount: 3 })

      expect(screen.getByRole('heading', { level: 2, name: EMPTY_LAYOUT.name })).toBeInTheDocument()
      expect(screen.getByText('No holes yet.')).toBeInTheDocument()
      expect(container.querySelector('.layout-totals')).toBeNull()
      expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    })
  })

  describe('front and back', () => {
    it.each(FRONT_BACK_SECTION_CASES)(
      'groups $label into its front and back',
      ({ layout, layoutCount, title, groups }) => {
        const { container } = renderSection({ layout, layoutCount })

        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(title)
        expect(textsIn(container, '.group-title')).toEqual(groups.map((group) => group.title))
        expect(textsIn(container, '.group-range')).toEqual(groups.map((group) => group.range))

        const groupElements = container.querySelectorAll('.hole-group')
        expect(groupElements).toHaveLength(groups.length)
        groups.forEach((group, index) => {
          expect(textsIn(groupElements[index], '.hole-number')).toEqual(group.labels)
        })
      }
    )

    it('shows one ungrouped list for a course that is not split', () => {
      const { container } = renderSection({ layout: UNSPLIT_NINE, layoutCount: 3 })

      expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0)
      expect(container.querySelectorAll('.hole-group')).toHaveLength(1)
      expect(textsIn(container, '.hole-number')).toEqual(UNSPLIT_NINE_LABELS)
    })
  })

  describe('amenities on holes', () => {
    it('shows an amenity on the hole it sits on, and on no other card', () => {
      const { container } = renderSection({
        layout: COURSE_C,
        layoutCount: 3,
        amenitiesByHole: AMENITIES_BY_HOLE,
      })

      const cardsWithAmenities = Array.from(container.querySelectorAll('.hole-card')).filter((card) =>
        card.querySelector('.hole-amenity')
      )

      expect(cardsWithAmenities).toHaveLength(1)
      expect(within(cardsWithAmenities[0]).getByText('C7')).toBeInTheDocument()
      expect(within(cardsWithAmenities[0]).getByText('Comfort station')).toBeInTheDocument()
    })

    it('shows no amenities when none are given', () => {
      const { container } = renderSection({ layout: COURSE_C, layoutCount: 3 })

      expect(container.querySelector('.hole-amenity')).toBeNull()
    })
  })

  describe('club shapes', () => {
    it.each(CLUB_SHAPES)('shows every hole of every course for $label', ({ sizes }) => {
      const layouts = makeClubLayouts(sizes)
      const { container } = render(
        <>
          {layouts.map((layout) => (
            <LayoutSection key={ layout.id } layout={ layout } layoutCount={ layouts.length } />
          ))}
        </>
      )
      const expectedTitles =
        sizes.length > 1
          ? sizes.map((unusedSize, index) => `Course ${String.fromCharCode(65 + index)}`)
          : ['Holes']

      expect(levelTwoHeadings()).toEqual(expectedTitles)
      expect(container.querySelectorAll('.hole-card')).toHaveLength(
        sizes.reduce((total, size) => total + size, 0)
      )
    })
  })
})
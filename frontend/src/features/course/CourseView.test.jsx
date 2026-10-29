import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import {
  CLUB_SHAPES,
  COURSE_NAME,
  HOLES_IN_MAIN_COURSE,
  NINES,
  THREE_NINE_HOLE_COUNT,
  makeClubResponse,
} from '../../test/fixtures/course'
import {
  AMENITIES_IN_SERVER_ORDER,
  AMENITY_ROW_CASES,
  MAIN_COURSE_GROUP_TITLES,
  MAIN_COURSE_HEADINGS,
  MAIN_COURSE_PAGE,
  NO_AMENITIES_PAGE,
  NO_COURSES_PAGE,
  NO_LISTS_PAGE,
  THREE_NINE_GROUP_TITLES,
  THREE_NINE_HEADINGS,
  THREE_NINE_PAGE,
} from '../../test/fixtures/coursePageCases'
import { createDeferred } from '../../test/helpers'
import { CourseView } from './CourseView'

const { apiMock } = vi.hoisted(() => ({
  apiMock: { getCourse: vi.fn() },
}))

vi.mock('../../api', () => ({ api: apiMock }))

const LOADING_TEXT = 'Loading course...'
const LOAD_ERROR_MESSAGE = 'could not fetch course'
const NO_COURSES_TEXT = 'No courses set up yet.'
const NO_AMENITIES_TEXT = 'No amenities yet.'
const HOLE_CARD_PART_COUNT = 3

// Actions
async function renderLoadedView(course) {
  apiMock.getCourse.mockResolvedValue(course)
  const view = render(<CourseView />)
  // The amenities section is always drawn once the course has loaded
  await screen.findByRole('heading', { level: 2, name: 'Amenities' })
  return view
}

function levelTwoHeadings() {
  return screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
}

function textsIn(root, selector) {
  return Array.from(root.querySelectorAll(selector)).map((node) => node.textContent)
}

function amenitySection() {
  return screen.getByRole('heading', { level: 2, name: 'Amenities' }).closest('section')
}

describe('CourseView', () => {
  beforeEach(() => {
    apiMock.getCourse.mockReset()
  })

  describe('loading the course', () => {
    it('shows a loading message until the course arrives', async () => {
      const course = createDeferred()
      apiMock.getCourse.mockReturnValue(course.promise)

      render(<CourseView />)

      expect(screen.getByText(LOADING_TEXT)).toBeInTheDocument()
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()

      await act(async () => {
        course.resolve(THREE_NINE_PAGE)
      })

      expect(screen.queryByText(LOADING_TEXT)).not.toBeInTheDocument()
      expect(levelTwoHeadings()).toEqual(THREE_NINE_HEADINGS)
    })

    it('shows the error and no sections when loading fails', async () => {
      apiMock.getCourse.mockRejectedValue(new Error(LOAD_ERROR_MESSAGE))

      render(<CourseView />)

      expect(await screen.findByText(LOAD_ERROR_MESSAGE)).toBeInTheDocument()
      expect(screen.queryByText(LOADING_TEXT)).not.toBeInTheDocument()
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })

    it('asks for the course once', async () => {
      await renderLoadedView(THREE_NINE_PAGE)

      expect(apiMock.getCourse).toHaveBeenCalledTimes(1)
    })
  })

  describe('courses', () => {
    it('shows a section for each course, then the amenities', async () => {
      await renderLoadedView(THREE_NINE_PAGE)

      expect(levelTwoHeadings()).toEqual(THREE_NINE_HEADINGS)
    })

    it('does not repeat the club name, which the side nav shows', async () => {
      await renderLoadedView(THREE_NINE_PAGE)

      expect(screen.queryByText(COURSE_NAME)).not.toBeInTheDocument()
    })

    it('shows the real par and yardage of each course', async () => {
      const { container } = await renderLoadedView(THREE_NINE_PAGE)

      expect(textsIn(container, '.layout-totals')).toEqual(NINES.map((nine) => nine.expectedTotals))
    })

    it('splits every nine into front and back', async () => {
      const { container } = await renderLoadedView(THREE_NINE_PAGE)

      expect(textsIn(container, '.group-title')).toEqual(THREE_NINE_GROUP_TITLES)
    })

    it('shows every hole of every course', async () => {
      const { container } = await renderLoadedView(THREE_NINE_PAGE)

      expect(container.querySelectorAll('.hole-card')).toHaveLength(THREE_NINE_HOLE_COUNT)
    })

    it('calls the only course "Holes" and splits it into front and back', async () => {
      const { container } = await renderLoadedView(MAIN_COURSE_PAGE)

      expect(levelTwoHeadings()).toEqual(MAIN_COURSE_HEADINGS)
      expect(textsIn(container, '.group-title')).toEqual(MAIN_COURSE_GROUP_TITLES)
      expect(container.querySelectorAll('.hole-card')).toHaveLength(HOLES_IN_MAIN_COURSE)
    })

    it.each(CLUB_SHAPES)('shows every course and hole of $label', async ({ sizes }) => {
      const { container } = await renderLoadedView(makeClubResponse(sizes))
      const courseHeadings =
        sizes.length > 1
          ? sizes.map((unusedSize, index) => `Course ${String.fromCharCode(65 + index)}`)
          : ['Holes']

      expect(levelTwoHeadings()).toEqual([...courseHeadings, 'Amenities'])
      expect(container.querySelectorAll('.hole-card')).toHaveLength(
        sizes.reduce((total, size) => total + size, 0)
      )
    })
  })

  describe('amenities', () => {
    it('keeps every hole card to the same plain parts, with no amenity on any of them', async () => {
        const { container } = await renderLoadedView(THREE_NINE_PAGE)

        const cards = Array.from(container.querySelectorAll('.hole-card'))

        expect(cards).toHaveLength(THREE_NINE_HOLE_COUNT)
        expect(container.querySelector('.hole-amenity')).toBeNull()
        for (const card of cards) {
        expect(card.children).toHaveLength(HOLE_CARD_PART_COUNT)
        }
    })

    it('lists every amenity, saying which hole each comfort station is on', async () => {
      await renderLoadedView(THREE_NINE_PAGE)

      const rows = within(amenitySection()).getAllByRole('listitem')

      expect(textsIn(amenitySection(), '.amenity-name')).toEqual(AMENITY_ROW_CASES.map((row) => row.name))
      expect(rows.map((row) => row.querySelector('.amenity-location')?.textContent ?? null)).toEqual(
        AMENITY_ROW_CASES.map((row) => row.location)
      )
    })
  })

  describe('empty lists', () => {
    it('says so when there are no courses, ignores the old flat hole list, and still lists the amenities', async () => {
      const { container } = await renderLoadedView(NO_COURSES_PAGE)

      expect(screen.getByText(NO_COURSES_TEXT)).toBeInTheDocument()
      expect(levelTwoHeadings()).toEqual(['Amenities'])
      expect(container.querySelectorAll('.hole-card')).toHaveLength(0)
      expect(within(amenitySection()).getAllByRole('listitem')).toHaveLength(AMENITIES_IN_SERVER_ORDER.length)
    })

    it('says so when there are no amenities, and still shows the courses', async () => {
      const { container } = await renderLoadedView(NO_AMENITIES_PAGE)

      expect(screen.getByText(NO_AMENITIES_TEXT)).toBeInTheDocument()
      expect(within(amenitySection()).queryAllByRole('listitem')).toHaveLength(0)
      expect(levelTwoHeadings()).toEqual(THREE_NINE_HEADINGS)
      expect(container.querySelectorAll('.hole-card')).toHaveLength(THREE_NINE_HOLE_COUNT)
    })

    it('copes with a response that has no lists at all', async () => {
      await renderLoadedView(NO_LISTS_PAGE)

      expect(screen.getByText(NO_COURSES_TEXT)).toBeInTheDocument()
      expect(screen.getByText(NO_AMENITIES_TEXT)).toBeInTheDocument()
    })
  })
})
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import { CourseView } from './CourseView'

const { apiMock } = vi.hoisted(() => ({
  apiMock: { getCourse: vi.fn() },
}))

vi.mock('../../api', () => ({ api: apiMock }))

// Test data
const COURSE_NAME = 'Dagobah Pines Golf Club'
const LOADING_TEXT = 'Loading course...'
const LOAD_ERROR_MESSAGE = 'could not fetch course'
const NO_HOLES_TEXT = 'No holes yet.'
const NO_AMENITIES_TEXT = 'No amenities yet.'
const HOLE_YARDAGE = 400

// A hole with no yardage key at all is made by leaving yardage undefined
function makeHole({ number, par = 4, yardage }) {
  const hole = { id: `hole-${number}`, hole_number: number, par }
  return yardage === undefined ? hole : { ...hole, yardage }
}

function makeHoles(count) {
  return Array.from({ length: count }, (unusedItem, index) =>
    makeHole({ number: index + 1, yardage: HOLE_YARDAGE })
  )
}

const CLUBHOUSE = { id: 'amenity-1', name: 'Clubhouse', type: 'clubhouse' }
const DRIVING_RANGE = { id: 'amenity-2', name: 'Driving Range', type: 'driving_range' }
const COMFORT_STATION = { id: 'amenity-3', name: 'Comfort Station 1', type: 'comfort_station' }
const AMENITIES = [CLUBHOUSE, DRIVING_RANGE, COMFORT_STATION]
const MARKUP_NAME = '<b>Pool</b>'
const MARKUP_AMENITY = { id: 'amenity-4', name: MARKUP_NAME, type: 'pool' }

function makeCourse({ holes = makeHoles(9), amenities = AMENITIES } = {}) {
  return { id: 'course-1', name: COURSE_NAME, holes, amenities }
}

// What each hole card should say, for each way the yardage can arrive
const CARD_CASES = [
  {
    label: 'a yardage',
    hole: makeHole({ number: 1, par: 4, yardage: 380 }),
    expected: ['Hole 1', 'Par 4', '380 yds'],
  },
  {
    label: 'a yardage of null',
    hole: makeHole({ number: 2, par: 3, yardage: null }),
    expected: ['Hole 2', 'Par 3'],
  },
  {
    label: 'no yardage field at all',
    hole: makeHole({ number: 3, par: 5 }),
    expected: ['Hole 3', 'Par 5'],
  },
  {
    label: 'a yardage of zero, shown rather than dropped',
    hole: makeHole({ number: 4, par: 4, yardage: 0 }),
    expected: ['Hole 4', 'Par 4', '0 yds'],
  },
]

// Course sizes that exist in the real world, so nothing is tied to 18 holes
const HOLE_COUNTS = [1, 9, 18, 27, 36]

// The server sends holes sorted, and the page shows them exactly as received
const OUT_OF_ORDER_HOLES = [
  makeHole({ number: 3, yardage: 510 }),
  makeHole({ number: 1, yardage: 380 }),
  makeHole({ number: 2, yardage: 165 }),
]
const OUT_OF_ORDER_HEADINGS = ['Hole 3', 'Hole 1', 'Hole 2']

function createDeferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

// Actions
async function renderLoadedView(course = makeCourse()) {
  apiMock.getCourse.mockResolvedValue(course)
  render(<CourseView />)
  await screen.findByRole('heading', { name: 'Holes' })
}

function sectionTitled(title) {
  return screen.getByRole('heading', { name: title }).closest('section')
}

function holeCards() {
  return within(sectionTitled('Holes')).queryAllByRole('listitem')
}

function cardTexts(card) {
  return Array.from(card.querySelectorAll('span')).map((span) => span.textContent)
}

function amenityNames() {
  return within(sectionTitled('Amenities'))
    .queryAllByRole('listitem')
    .map((item) => item.textContent)
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
        course.resolve(makeCourse())
      })

      expect(screen.queryByText(LOADING_TEXT)).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Holes' })).toBeInTheDocument()
    })

    it('shows the error and no sections when loading fails', async () => {
      apiMock.getCourse.mockRejectedValue(new Error(LOAD_ERROR_MESSAGE))

      render(<CourseView />)

      expect(await screen.findByText(LOAD_ERROR_MESSAGE)).toBeInTheDocument()
      expect(screen.queryByText(LOADING_TEXT)).not.toBeInTheDocument()
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })

    it('asks for the course once', async () => {
      await renderLoadedView()

      expect(apiMock.getCourse).toHaveBeenCalledTimes(1)
    })
  })

  describe('layout', () => {
    it('has only the two section headings, and does not repeat the course name the side nav shows', async () => {
      await renderLoadedView()

      const headings = screen.getAllByRole('heading').map((heading) => heading.textContent)

      expect(headings).toEqual(['Holes', 'Amenities'])
      expect(screen.queryByText(COURSE_NAME)).not.toBeInTheDocument()
    })

    it.each(CARD_CASES)('shows a hole card with $label', async ({ hole, expected }) => {
      await renderLoadedView(makeCourse({ holes: [hole] }))

      const cards = holeCards()

      expect(cards).toHaveLength(1)
      expect(cardTexts(cards[0])).toEqual(expected)
    })

    it('shows the holes in the order the server sends them', async () => {
      await renderLoadedView(makeCourse({ holes: OUT_OF_ORDER_HOLES }))

      const headings = holeCards().map((card) => cardTexts(card)[0])

      expect(headings).toEqual(OUT_OF_ORDER_HEADINGS)
    })

    it.each(HOLE_COUNTS)('shows every hole of a %i-hole course', async (count) => {
      await renderLoadedView(makeCourse({ holes: makeHoles(count) }))

      const cards = holeCards()

      expect(cards).toHaveLength(count)
      expect(cardTexts(cards[count - 1])[0]).toBe(`Hole ${count}`)
    })

    it('lists the amenities in the order received', async () => {
      await renderLoadedView()

      expect(amenityNames()).toEqual(AMENITIES.map((amenity) => amenity.name))
    })

    it('shows an amenity name as text, never as markup', async () => {
      await renderLoadedView(makeCourse({ amenities: [MARKUP_AMENITY] }))

      expect(screen.getByText(MARKUP_NAME)).toBeInTheDocument()
      expect(sectionTitled('Amenities').querySelector('b')).toBeNull()
    })
  })

  describe('empty lists', () => {
    it('says so when there are no holes, and still shows the amenities', async () => {
      await renderLoadedView(makeCourse({ holes: [] }))

      expect(screen.getByText(NO_HOLES_TEXT)).toBeInTheDocument()
      expect(holeCards()).toHaveLength(0)
      expect(amenityNames()).toHaveLength(AMENITIES.length)
    })

    it('says so when there are no amenities, and still shows the holes', async () => {
      await renderLoadedView(makeCourse({ amenities: [] }))

      expect(screen.getByText(NO_AMENITIES_TEXT)).toBeInTheDocument()
      expect(amenityNames()).toHaveLength(0)
      expect(holeCards()).toHaveLength(9)
    })

    it('copes with a response that has no lists at all', async () => {
      await renderLoadedView({ id: 'course-1', name: COURSE_NAME })

      expect(screen.getByText(NO_HOLES_TEXT)).toBeInTheDocument()
      expect(screen.getByText(NO_AMENITIES_TEXT)).toBeInTheDocument()
    })
  })
})
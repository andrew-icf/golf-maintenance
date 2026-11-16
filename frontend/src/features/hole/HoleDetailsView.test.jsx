import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PREVIEW_NOTICE } from '../../test/fixtures/checklistViewCases'
import { holeIdOf } from '../../test/fixtures/course'
import { MARKUP_NAME } from '../../test/fixtures/courseViewCases'
import { CHECKLIST_NAME, RESPONSIBLE_NAME, VIEWER_PAGE_CASES } from '../../test/fixtures/holeChecklistCases'
import {
  AMENITIES_ON_HOLE_CASES,
  HOLE_PAGE_CASES,
  HOLE_WITH_NO_AMENITIES_ID,
  MARKUP_AMENITY_PAGE,
  MULTI_AMENITY_PAGE,
  NOT_FOUND_CASES,
  YARDAGE_CASES,
  YARDAGE_PAGE,
} from '../../test/fixtures/holeDetailsCases'
import { CUSTOM_TASK_LIST, SAMPLE_TASK_LIST } from '../../test/fixtures/holeTaskCases'
import { LUKE } from '../../test/fixtures/taskPermissionCases'
import { createDeferred } from '../../test/helpers'
import { HoleDetailsView } from './HoleDetailsView'

const { apiMock, useAuthMock } = vi.hoisted(() => ({
  apiMock: { getCourse: vi.fn(), getHoleTasks: vi.fn() },
  useAuthMock: vi.fn(),
}))

vi.mock('../../api', () => ({ api: apiMock }))
vi.mock('../auth/AuthContext', () => ({ useAuth: useAuthMock }))

const LOADING_TEXT = 'Loading hole...'
const LOAD_ERROR_MESSAGE = 'could not fetch course'
const TASK_ERROR_MESSAGE = 'could not fetch hole tasks'
const NOT_FOUND_TEXT = 'Hole not found.'
const NO_AMENITIES_TEXT = 'No amenities on this hole.'
const NO_TASKS_TEXT = 'There are no tasks for this hole today.'
const COURSE_LIST_TEXT = 'Course list page'
const BACK_LINK_NAME = '← Course'
const CLUBHOUSE_NAME = 'Clubhouse'
const DEFAULT_HOLE_ID = holeIdOf('C', 7)

// Holes the checklist has to show on, with and without amenities
const CHECKLIST_HOLE_CASES = [
  { label: 'a hole with amenities', holeId: DEFAULT_HOLE_ID },
  { label: 'a hole with none', holeId: HOLE_WITH_NO_AMENITIES_ID },
]

// Actions
function renderPage(holeId = DEFAULT_HOLE_ID) {
  return render(
    <MemoryRouter initialEntries={ [`/course/holes/${holeId}`] }>
      <Routes>
        <Route path="/course" element={ <p>{ COURSE_LIST_TEXT }</p> } />
        <Route path="/course/holes/:holeId" element={ <HoleDetailsView /> } />
      </Routes>
    </MemoryRouter>
  )
}

// Waits for the page to settle, which both a found and a missing hole do by showing the back link
async function renderLoadedPage(course, holeId) {
  apiMock.getCourse.mockResolvedValue(course)
  const view = renderPage(holeId)
  await screen.findByRole('link', { name: BACK_LINK_NAME })
  return view
}

function factValue(name) {
  return screen.getByText(name).nextElementSibling.textContent
}

function textsIn(container, selector) {
  return Array.from(container.querySelectorAll(selector)).map((node) => node.textContent)
}

function checklistRegion() {
  return screen.getByRole('region', { name: CHECKLIST_NAME })
}

describe('HoleDetailsView', () => {
  beforeEach(() => {
    apiMock.getCourse.mockReset()
    apiMock.getHoleTasks.mockReset()
    apiMock.getHoleTasks.mockResolvedValue(SAMPLE_TASK_LIST)
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({ user: LUKE })
  })

  describe('loading the course', () => {
    it('shows a loading message until the course arrives', async () => {
      const course = createDeferred()
      apiMock.getCourse.mockReturnValue(course.promise)

      renderPage()

      expect(screen.getByText(LOADING_TEXT)).toBeInTheDocument()
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      expect(screen.queryByRole('region')).not.toBeInTheDocument()

      await act(async () => {
        course.resolve(MULTI_AMENITY_PAGE)
      })

      expect(screen.queryByText(LOADING_TEXT)).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: 'C7' })).toBeInTheDocument()
    })

    it('shows the error, with a way back, when loading fails', async () => {
      apiMock.getCourse.mockRejectedValue(new Error(LOAD_ERROR_MESSAGE))

      renderPage()

      expect(await screen.findByText(LOAD_ERROR_MESSAGE)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: BACK_LINK_NAME })).toBeInTheDocument()
      expect(screen.queryByText(LOADING_TEXT)).not.toBeInTheDocument()
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
      expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })

    it('asks for the course once', async () => {
      await renderLoadedPage(MULTI_AMENITY_PAGE)

      expect(apiMock.getCourse).toHaveBeenCalledTimes(1)
    })
  })

  describe('the task list', () => {
    it('asks for the task list once', async () => {
      await renderLoadedPage(MULTI_AMENITY_PAGE)

      expect(apiMock.getHoleTasks).toHaveBeenCalledTimes(1)
    })

    it('keeps showing the loading message until the task list has arrived too', async () => {
      const tasks = createDeferred()
      apiMock.getCourse.mockResolvedValue(MULTI_AMENITY_PAGE)
      apiMock.getHoleTasks.mockReturnValue(tasks.promise)

      renderPage()
      await act(async () => {})

      expect(screen.getByText(LOADING_TEXT)).toBeInTheDocument()
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()

      await act(async () => {
        tasks.resolve(SAMPLE_TASK_LIST)
      })

      expect(screen.queryByText(LOADING_TEXT)).not.toBeInTheDocument()
      expect(checklistRegion()).toBeInTheDocument()
    })

    it('shows the hole, with a message where the checklist would be, when the task list cannot be loaded', async () => {
      apiMock.getHoleTasks.mockRejectedValue(new Error(TASK_ERROR_MESSAGE))

      const { container } = await renderLoadedPage(MULTI_AMENITY_PAGE)

      expect(screen.getByRole('alert')).toHaveTextContent(`Could not load the checklist: ${TASK_ERROR_MESSAGE}`)
      expect(screen.getByRole('heading', { level: 2, name: 'C7' })).toBeInTheDocument()
      expect(container.querySelectorAll('.hole-details-amenity').length).toBeGreaterThan(0)
      expect(screen.queryByRole('region', { name: CHECKLIST_NAME })).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: RESPONSIBLE_NAME })).not.toBeInTheDocument()
    })

    it('says there are no tasks when the club has none', async () => {
      apiMock.getHoleTasks.mockResolvedValue({ duties: [], tasks: [] })

      await renderLoadedPage(MULTI_AMENITY_PAGE)

      expect(screen.getByText(NO_TASKS_TEXT)).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: RESPONSIBLE_NAME })).not.toBeInTheDocument()
    })

    it('builds the checklist from the tasks the server sent', async () => {
      apiMock.getHoleTasks.mockResolvedValue(CUSTOM_TASK_LIST)

      await renderLoadedPage(MULTI_AMENITY_PAGE)

      expect(screen.getByRole('checkbox', { name: 'Green: Inspected' })).toBeInTheDocument()
      expect(screen.queryByRole('checkbox', { name: 'Tee box: Mowed' })).not.toBeInTheDocument()
    })
  })

  describe('a hole that exists', () => {
    it.each(HOLE_PAGE_CASES)(
      'shows $label',
      async ({ course, holeId, heading, subtitle, par, yardage }) => {
        const { container } = await renderLoadedPage(course, holeId)

        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(heading)
        expect(container.querySelector('.hole-details-subtitle')?.textContent ?? null).toBe(subtitle)
        expect(factValue('Par')).toBe(par)
        expect(factValue('Yardage')).toBe(yardage)
      }
    )

    it.each(YARDAGE_CASES)('shows the yardage for $label', async ({ holeId, expected }) => {
      await renderLoadedPage(YARDAGE_PAGE, holeId)

      expect(factValue('Yardage')).toBe(expected === null ? '—' : `${expected} yds`)
    })
  })

  describe('the checklist', () => {
    it.each(CHECKLIST_HOLE_CASES)(
      'shows who is responsible, the preview notice, and the checklist on $label',
      async ({ holeId }) => {
        await renderLoadedPage(MULTI_AMENITY_PAGE, holeId)

        expect(screen.getByRole('region', { name: RESPONSIBLE_NAME })).toBeInTheDocument()
        expect(screen.getByText(PREVIEW_NOTICE)).toBeInTheDocument()
        expect(checklistRegion()).toBeInTheDocument()
      }
    )

    it('puts the facts first, then who is responsible, the notice, the checklist, and the amenities', async () => {
      const { container } = await renderLoadedPage(MULTI_AMENITY_PAGE)
      const partsInOrder = [
        container.querySelector('.hole-details-facts'),
        screen.getByRole('region', { name: RESPONSIBLE_NAME }),
        screen.getByText(PREVIEW_NOTICE),
        checklistRegion(),
        screen.getByRole('heading', { level: 3, name: 'Amenities on this hole' }),
      ]

      for (let index = 1; index < partsInOrder.length; index++) {
        const follows = partsInOrder[index - 1].compareDocumentPosition(partsInOrder[index])

        expect(follows & Node.DOCUMENT_POSITION_FOLLOWING, `part ${index}`).toBeTruthy()
      }
    })

    it.each(VIEWER_PAGE_CASES)(
      'tags the right columns as theirs for $name',
      async ({ user, expectedYours }) => {
        useAuthMock.mockReturnValue({ user })
        const { container } = await renderLoadedPage(MULTI_AMENITY_PAGE)

        const heads = Array.from(container.querySelectorAll('.checklist-head'))

        expect(heads.map((head) => head.textContent.includes('Your tasks'))).toEqual(expectedYours)
      }
    )
  })

  describe('amenities on the hole', () => {
    it.each(AMENITIES_ON_HOLE_CASES)('lists $label', async ({ holeId, names, types }) => {
      const { container } = await renderLoadedPage(MULTI_AMENITY_PAGE, holeId)

      expect(textsIn(container, '.hole-details-amenity-name')).toEqual(names)
      expect(textsIn(container, '.hole-details-amenity-type')).toEqual(types)
      expect(screen.queryByText(NO_AMENITIES_TEXT)).not.toBeInTheDocument()
    })

    it('says so for a hole with none', async () => {
      const { container } = await renderLoadedPage(MULTI_AMENITY_PAGE, HOLE_WITH_NO_AMENITIES_ID)

      expect(screen.getByText(NO_AMENITIES_TEXT)).toBeInTheDocument()
      expect(container.querySelectorAll('.hole-details-amenity')).toHaveLength(0)
    })

    it('never lists an amenity that belongs to the whole club', async () => {
      await renderLoadedPage(MULTI_AMENITY_PAGE, DEFAULT_HOLE_ID)

      expect(screen.queryByText(CLUBHOUSE_NAME)).not.toBeInTheDocument()
    })

    it('shows an amenity name as text, never as markup', async () => {
      const { container } = await renderLoadedPage(MARKUP_AMENITY_PAGE, DEFAULT_HOLE_ID)

      expect(screen.getByText(MARKUP_NAME)).toBeInTheDocument()
      expect(container.querySelector('b')).toBeNull()
    })
  })

  describe('a hole that is not there', () => {
    it.each(NOT_FOUND_CASES)('says so for $label, with a way back', async ({ course, holeId }) => {
      await renderLoadedPage(course, holeId)

      expect(screen.getByText(NOT_FOUND_TEXT)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: BACK_LINK_NAME })).toBeInTheDocument()
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
      expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })
  })

  describe('going back', () => {
    it('goes to the course page when the back link is used', async () => {
      await renderLoadedPage(MULTI_AMENITY_PAGE)

      await userEvent.click(screen.getByRole('link', { name: BACK_LINK_NAME }))

      expect(screen.getByText(COURSE_LIST_TEXT)).toBeInTheDocument()
    })
  })
})
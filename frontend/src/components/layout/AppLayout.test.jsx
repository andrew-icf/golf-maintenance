import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { NAV_ITEMS } from './navItems'

const { apiMock, useAuthMock } = vi.hoisted(() => ({
  apiMock: { getCourse: vi.fn() },
  useAuthMock: vi.fn(),
}))

vi.mock('../../api', () => ({ api: apiMock }))
vi.mock('../../features/auth/AuthContext', () => ({ useAuth: useAuthMock }))

// Test data. Today is Wednesday 2026-10-21.
const TODAY = new Date(2026, 9, 21, 12, 0)
const TODAY_TEXT = 'Wed, Oct 21'
const APP_NAME = 'Golf Maintenance'

const MON_MOTHMA = {
  id: 'user-mon',
  full_name: 'Mon Mothma',
  job_title: 'superintendent',
  role: 'admin',
}
const JOB_TITLE_LABEL = 'Superintendent'

   const COURSE_NAME = 'Dagobah Pines Golf Club'
   const HOLES_PER_COURSE = 9
   const HOLE_YARDAGE = 400
   const HOLES_TEXT = '27 holes · 3 courses'
   const YARDAGE_TEXT = '10,800 yds'

   function makeNine(code) {
     return {
       id: `layout-${code}`,
       name: `Course ${code}`,
       code,
       position: code.charCodeAt(0) - 64,
       front_hole_count: 5,
       holes: Array.from({ length: HOLES_PER_COURSE }, (unusedItem, index) => ({
         id: `hole-${code}${index + 1}`,
         layout_id: `layout-${code}`,
         hole_number: index + 1,
         par: 4,
         yardage: HOLE_YARDAGE,
       })),
     }
   }

   const COURSE_RESPONSE = {
     id: 'course-1',
     name: COURSE_NAME,
     layouts: [makeNine('A'), makeNine('B'), makeNine('C')],
     // The server also sends this flat list, which the sidebar does not read
     holes: [],
     amenities: [],
   }

const NOT_IN_NAV_PATH = '/elsewhere'
const NOT_IN_NAV_CONTENT = 'Elsewhere content'
const LOGIN_PAGE_TEXT = 'Login page'
const LOGOUT_ERROR_MESSAGE = 'Could not log out. Try again.'

function contentFor(item) {
  return `${item.label} content`
}

function createDeferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

// Scenarios
const logoutMock = vi.fn()

function givenLoggedInAs(user) {
  useAuthMock.mockReturnValue({ user, logout: logoutMock })
}

function givenCourse() {
  apiMock.getCourse.mockResolvedValue(COURSE_RESPONSE)
}

// Actions
function renderLayout(path = '/schedule') {
  return render(
    <MemoryRouter initialEntries={ [path] }>
      <Routes>
        <Route path="/login" element={ <p>{ LOGIN_PAGE_TEXT }</p> } />
        <Route element={ <AppLayout /> }>
          {NAV_ITEMS.map((item) => (
            <Route key={ item.path } path={ item.path } element={ <p>{ contentFor(item) }</p> } />
          ))}
          <Route path={ NOT_IN_NAV_PATH } element={ <p>{ NOT_IN_NAV_CONTENT }</p> } />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

async function renderLoadedLayout(path) {
  const view = renderLayout(path)
  await screen.findByText(COURSE_NAME)
  return view
}

describe('AppLayout', () => {
  beforeEach(() => {
    apiMock.getCourse.mockReset()
    useAuthMock.mockReset()
    logoutMock.mockReset()
    logoutMock.mockResolvedValue()
    // Only Date is faked, so timers and promises keep working normally
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(TODAY)
    givenLoggedInAs(MON_MOTHMA)
    givenCourse()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('the page frame', () => {
    it('puts the page in the main area, with the side nav and the top bar around it', async () => {
      await renderLoadedLayout('/schedule')

      expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      expect(within(screen.getByRole('main')).getByText('Schedule content')).toBeInTheDocument()
    })

    it.each(NAV_ITEMS)('shows $title as the heading at $path', async (item) => {
      await renderLoadedLayout(item.path)

      expect(screen.getByRole('heading', { level: 1, name: item.title })).toBeInTheDocument()
      expect(screen.getByText(contentFor(item))).toBeInTheDocument()
    })

    it('shows who is logged in', async () => {
      await renderLoadedLayout()

      expect(screen.getByText(MON_MOTHMA.full_name)).toBeInTheDocument()
      expect(screen.getByText(JOB_TITLE_LABEL)).toBeInTheDocument()
    })

    it('follows a nav link to another page, changing both the heading and the content', async () => {
      await renderLoadedLayout('/schedule')

      await userEvent.click(screen.getByRole('link', { name: 'Course' }))

      expect(screen.getByRole('heading', { level: 1, name: 'Course' })).toBeInTheDocument()
      expect(screen.getByText('Course content')).toBeInTheDocument()
      expect(screen.queryByText('Schedule content')).not.toBeInTheDocument()
    })
  })

  describe('page width', () => {
    it.each(NAV_ITEMS)('gives $label the $width width', async (item) => {
      const { container } = await renderLoadedLayout(item.path)

      expect(container.querySelector('.app-layout-page')).toHaveClass(`app-layout-page-${item.width}`)
    })

    it('gives a page that is not in the nav the reading width', async () => {
      const { container } = await renderLoadedLayout(NOT_IN_NAV_PATH)

      expect(screen.getByText(NOT_IN_NAV_CONTENT)).toBeInTheDocument()
      expect(container.querySelector('.app-layout-page')).toHaveClass('app-layout-page-reading')
    })
  })

  describe('course details in the side nav', () => {
    it('shows only the app name until the course has loaded', async () => {
      const course = createDeferred()
      apiMock.getCourse.mockReturnValue(course.promise)

      renderLayout()

      expect(screen.getByText(APP_NAME)).toBeInTheDocument()
      expect(screen.queryByText(COURSE_NAME)).not.toBeInTheDocument()
      expect(screen.queryByText('Total yardage')).not.toBeInTheDocument()

      await act(async () => {
        course.resolve(COURSE_RESPONSE)
      })

      expect(screen.getByText(COURSE_NAME)).toBeInTheDocument()
    })

    it("shows the name, hole count, total yardage, and today's date once loaded", async () => {
      await renderLoadedLayout()

      expect(screen.getByText(HOLES_TEXT)).toBeInTheDocument()
      expect(screen.getByText(YARDAGE_TEXT)).toBeInTheDocument()
      expect(screen.getByText(TODAY_TEXT)).toBeInTheDocument()
    })

    it('asks for the course once, even when moving between pages', async () => {
      await renderLoadedLayout('/schedule')

      await userEvent.click(screen.getByRole('link', { name: 'Equipment' }))
      await userEvent.click(screen.getByRole('link', { name: 'Clock' }))

      expect(screen.getByText(contentFor(NAV_ITEMS[3]))).toBeInTheDocument()
      expect(apiMock.getCourse).toHaveBeenCalledTimes(1)
    })

    it('keeps the rest of the page working when the course cannot be loaded', async () => {
      apiMock.getCourse.mockRejectedValue(new Error('could not fetch course'))

      renderLayout()

      expect(await screen.findByText('Schedule content')).toBeInTheDocument()
      expect(screen.getByText(APP_NAME)).toBeInTheDocument()
      expect(screen.queryByText(COURSE_NAME)).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getAllByRole('link')).toHaveLength(NAV_ITEMS.length)
    })
  })

  describe('logging out', () => {
    it('logs out and goes to the login page', async () => {
      await renderLoadedLayout()

      await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

      expect(logoutMock).toHaveBeenCalledTimes(1)
      expect(await screen.findByText(LOGIN_PAGE_TEXT)).toBeInTheDocument()
    })

    it('stays on the page and shows an error when logging out fails', async () => {
      logoutMock.mockRejectedValue(new Error('network down'))
      await renderLoadedLayout()

      await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(LOGOUT_ERROR_MESSAGE)
      expect(screen.getByText('Schedule content')).toBeInTheDocument()
      expect(screen.queryByText(LOGIN_PAGE_TEXT)).not.toBeInTheDocument()
    })
  })
})
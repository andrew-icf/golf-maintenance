import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { LANDING_PATH, NAV_ITEMS } from './components/layout/navItems'

const { apiMock, useAuthMock } = vi.hoisted(() => ({
  apiMock: { getCourse: vi.fn() },
  useAuthMock: vi.fn(),
}))

vi.mock('./api', () => ({ api: apiMock }))
vi.mock('./features/auth/AuthContext', () => ({ useAuth: useAuthMock }))

// Stand-ins for the login form and the four pages. Each has its own tests,
// so here they only need to be recognizable on screen.
vi.mock('./features/auth/LoginForm', async () => {
  const { createElement } = await import('react')
  return { LoginForm: () => createElement('p', null, 'Login form') }
})

vi.mock('./features/schedule/ScheduleView', async () => {
  const { createElement } = await import('react')
  return { ScheduleView: () => createElement('p', null, 'Schedule page') }
})

vi.mock('./features/course/CourseView', async () => {
  const { createElement } = await import('react')
  return { CourseView: () => createElement('p', null, 'Course page') }
})

vi.mock('./features/equipment/EquipmentView', async () => {
  const { createElement } = await import('react')
  return { EquipmentView: () => createElement('p', null, 'Equipment page') }
})

vi.mock('./features/clock/ClockPanel', async () => {
  const { createElement } = await import('react')
  return { ClockPanel: () => createElement('p', null, 'Clock page') }
})

// Test data
const MON_MOTHMA = {
  id: 'user-mon',
  full_name: 'Mon Mothma',
  job_title: 'superintendent',
  role: 'admin',
}
const COURSE_NAME = 'Dagobah Pines Golf Club'
const COURSE_RESPONSE = { id: 'course-1', name: COURSE_NAME, holes: [], amenities: [] }

const LOGIN_TEXT = 'Login form'
const LOADING_TEXT = 'Loading...'
const APP_NAME = 'Golf Maintenance'

function itemAt(path) {
  return NAV_ITEMS.find((item) => item.path === path)
}

const LANDING_ITEM = itemAt(LANDING_PATH)
const COURSE_ITEM = itemAt('/course')
const EQUIPMENT_ITEM = itemAt('/equipment')
const CLOCK_ITEM = itemAt('/clock')

// Each page stand-in above says "<label> page"
function pageText(item) {
  return `${item.label} page`
}

const LOADING_CASES = [
  { label: 'nobody is known yet', user: null },
  { label: 'a user is already known', user: MON_MOTHMA },
]

const LOGGED_OUT_PATHS = [
  { label: 'the site root', path: '/' },
  { label: 'the login page itself', path: '/login' },
  { label: 'the schedule page', path: '/schedule' },
  { label: 'the course page', path: '/course' },
  { label: 'the equipment page', path: '/equipment' },
  { label: 'the clock page', path: '/clock' },
  { label: 'an unknown page', path: '/unknown' },
]

const LOGGED_IN_REDIRECT_PATHS = [
  { label: 'the site root', path: '/' },
  { label: 'the login page', path: '/login' },
  { label: 'an unknown page', path: '/unknown' },
  { label: 'a sub-page of a page', path: '/schedule/extra' },
]

// Scenarios
function givenAuth({ user = null, loading = false } = {}) {
  useAuthMock.mockReturnValue({ user, loading, logout: vi.fn().mockResolvedValue() })
}

// Actions
// The same wrapper is rendered again to change the session, so the router keeps its place
function Harness({ path }) {
  return (
    <MemoryRouter initialEntries={ [path] }>
      <App />
    </MemoryRouter>
  )
}

function renderApp(path = '/') {
  return render(<Harness path={ path } />)
}

// Waits for the course details to arrive in the side nav, so nothing updates after the test ends
async function renderLoadedApp(path) {
  const view = renderApp(path)
  await screen.findByText(COURSE_NAME)
  return view
}

describe('App', () => {
  beforeEach(() => {
    apiMock.getCourse.mockReset()
    apiMock.getCourse.mockResolvedValue(COURSE_RESPONSE)
    useAuthMock.mockReset()
  })

  describe('while the session is being checked', () => {
    it.each(LOADING_CASES)('shows only a loading message when $label', ({ user }) => {
      givenAuth({ user, loading: true })

      renderApp('/schedule')

      expect(screen.getByText(LOADING_TEXT)).toBeInTheDocument()
      expect(screen.queryByText(LOGIN_TEXT)).not.toBeInTheDocument()
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
      expect(screen.queryByText(pageText(LANDING_ITEM))).not.toBeInTheDocument()
    })
  })

  describe('when logged out', () => {
    it.each(LOGGED_OUT_PATHS)('sends $label to the login page', ({ path }) => {
      givenAuth()

      renderApp(path)

      expect(screen.getByText(LOGIN_TEXT)).toBeInTheDocument()
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
      for (const item of NAV_ITEMS) {
        expect(screen.queryByText(pageText(item))).not.toBeInTheDocument()
      }
      // The course details are only requested once someone is logged in
      expect(apiMock.getCourse).not.toHaveBeenCalled()
    })

    it('shows the app name above the login form', () => {
      givenAuth()

      renderApp('/login')

      expect(screen.getByText(APP_NAME)).toBeInTheDocument()
    })
  })

  describe('when logged in', () => {
    beforeEach(() => {
      givenAuth({ user: MON_MOTHMA })
    })

    it.each(LOGGED_IN_REDIRECT_PATHS)('sends $label to the landing page', async ({ path }) => {
      await renderLoadedApp(path)

      expect(screen.getByText(pageText(LANDING_ITEM))).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: LANDING_ITEM.title })).toBeInTheDocument()
      expect(screen.queryByText(LOGIN_TEXT)).not.toBeInTheDocument()
    })

    it.each(NAV_ITEMS)('shows $label inside the layout at $path', async (item) => {
      await renderLoadedApp(item.path)

      expect(within(screen.getByRole('main')).getByText(pageText(item))).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: item.title })).toBeInTheDocument()
      expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
      expect(screen.queryByText(LOGIN_TEXT)).not.toBeInTheDocument()
    })

    it('matches page paths without regard to case', async () => {
      await renderLoadedApp('/COURSE')

      expect(screen.getByText(pageText(COURSE_ITEM))).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: COURSE_ITEM.title })).toBeInTheDocument()
    })

    it('keeps one layout while moving between pages, asking for the course only once', async () => {
      await renderLoadedApp(LANDING_PATH)

      await userEvent.click(screen.getByRole('link', { name: EQUIPMENT_ITEM.label }))
      expect(screen.getByText(pageText(EQUIPMENT_ITEM))).toBeInTheDocument()

      await userEvent.click(screen.getByRole('link', { name: CLOCK_ITEM.label }))
      expect(screen.getByText(pageText(CLOCK_ITEM))).toBeInTheDocument()

      expect(screen.getByText(COURSE_NAME)).toBeInTheDocument()
      expect(apiMock.getCourse).toHaveBeenCalledTimes(1)
    })
  })

  describe('when the session changes', () => {
    it('moves from the login page to the landing page after logging in', async () => {
      givenAuth()
      const view = renderApp('/login')
      expect(screen.getByText(LOGIN_TEXT)).toBeInTheDocument()

      givenAuth({ user: MON_MOTHMA })
      view.rerender(<Harness path="/login" />)

      expect(await screen.findByText(pageText(LANDING_ITEM))).toBeInTheDocument()
      expect(screen.queryByText(LOGIN_TEXT)).not.toBeInTheDocument()
      await screen.findByText(COURSE_NAME)
    })

    it('moves from a page to the login page after logging out', async () => {
      givenAuth({ user: MON_MOTHMA })
      const view = await renderLoadedApp('/course')

      givenAuth()
      view.rerender(<Harness path="/course" />)

      expect(screen.getByText(LOGIN_TEXT)).toBeInTheDocument()
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
      expect(screen.queryByText(pageText(COURSE_ITEM))).not.toBeInTheDocument()
    })
  })
})
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JOB_TITLE_LABELS } from '../../constants/jobTitles'
import { TopBar } from './TopBar'

// Test data
const PAGE_TITLES = ['Schedule', 'Course', 'Equipment', 'Clock']

const MON_MOTHMA = { full_name: 'Mon Mothma', job_title: 'superintendent' }
const NO_TITLE_USER = { full_name: 'Luke Skywalker', job_title: null }
const UNKNOWN_TITLE_USER = { full_name: 'Han Solo', job_title: 'smuggler' }
const MARKUP_NAME = '<b>Leia</b>'
const MARKUP_USER = { full_name: MARKUP_NAME, job_title: 'office_admin' }

const JOB_TITLE_CASES = Object.entries(JOB_TITLE_LABELS).map(([value, label]) => ({ value, label }))

const LOGOUT_ERROR_MESSAGE = 'Could not log out. Try again.'

function createDeferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

// Actions
function renderTopBar({ title = 'Schedule', user = MON_MOTHMA, onLogout = vi.fn().mockResolvedValue() } = {}) {
  const view = render(<TopBar title={ title } user={ user } onLogout={ onLogout } />)
  return { onLogout, ...view }
}

// The button's name changes while logging out, so find it by either wording
function logoutButton() {
  return screen.getByRole('button', { name: /log(ging)? out/i })
}

describe('TopBar', () => {
  describe('header content', () => {
    it.each(PAGE_TITLES)('shows %s as the level-one heading', (title) => {
      renderTopBar({ title })

      expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    })

    it("shows the user's name", () => {
      renderTopBar()

      expect(screen.getByText(MON_MOTHMA.full_name)).toBeInTheDocument()
    })

    it.each(JOB_TITLE_CASES)('shows "$label" for the job title $value', ({ value, label }) => {
      renderTopBar({ user: { ...MON_MOTHMA, job_title: value } })

      expect(screen.getByText(label)).toBeInTheDocument()
    })

    it('shows no job title line for a user who has none', () => {
      const { container } = renderTopBar({ user: NO_TITLE_USER })

      expect(screen.getByText(NO_TITLE_USER.full_name)).toBeInTheDocument()
      expect(container.querySelector('.top-bar-user-title')).toBeNull()
    })

    it('shows no job title line for a title it does not recognize', () => {
      const { container } = renderTopBar({ user: UNKNOWN_TITLE_USER })

      expect(screen.getByText(UNKNOWN_TITLE_USER.full_name)).toBeInTheDocument()
      expect(container.querySelector('.top-bar-user-title')).toBeNull()
    })

    it('shows the name as text, never as markup', () => {
      const { container } = renderTopBar({ user: MARKUP_USER })

      expect(screen.getByText(MARKUP_NAME)).toBeInTheDocument()
      expect(container.querySelector('b')).toBeNull()
    })
  })

  describe('logging out', () => {
    it('offers a Log out button, with no error showing', () => {
      renderTopBar()

      expect(screen.getByRole('button', { name: 'Log out' })).toBeEnabled()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('calls the logout handler once when clicked', async () => {
      const { onLogout } = renderTopBar()

      await userEvent.click(logoutButton())

      expect(onLogout).toHaveBeenCalledTimes(1)
    })

    it('disables the button and says so while logging out, then recovers', async () => {
      const logout = createDeferred()
      renderTopBar({ onLogout: vi.fn().mockReturnValue(logout.promise) })

      await userEvent.click(logoutButton())

      expect(screen.getByRole('button', { name: 'Logging out...' })).toBeDisabled()

      await act(async () => {
        logout.resolve()
      })

      expect(screen.getByRole('button', { name: 'Log out' })).toBeEnabled()
    })

    it('ignores a second click while the first is in progress', async () => {
      const logout = createDeferred()
      const { onLogout } = renderTopBar({ onLogout: vi.fn().mockReturnValue(logout.promise) })

      await userEvent.click(logoutButton())
      await userEvent.click(logoutButton())

      expect(onLogout).toHaveBeenCalledTimes(1)

      await act(async () => {
        logout.resolve()
      })
    })

    it('shows an error and stays usable when logging out fails', async () => {
      renderTopBar({ onLogout: vi.fn().mockRejectedValue(new Error('network down')) })

      await userEvent.click(logoutButton())

      expect(await screen.findByRole('alert')).toHaveTextContent(LOGOUT_ERROR_MESSAGE)
      expect(screen.getByRole('button', { name: 'Log out' })).toBeEnabled()
    })

    it('clears the error when trying again', async () => {
      const onLogout = vi
        .fn()
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValue()
      renderTopBar({ onLogout })
      await userEvent.click(logoutButton())
      await screen.findByRole('alert')

      await userEvent.click(logoutButton())

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(onLogout).toHaveBeenCalledTimes(2)
    })
  })
})
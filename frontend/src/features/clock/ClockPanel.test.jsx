import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ClockPanel } from './ClockPanel'

const { useAuthMock, refreshUserMock, apiMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  refreshUserMock: vi.fn(),
  apiMock: { clockIn: vi.fn(), clockOut: vi.fn() },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: useAuthMock,
}))

vi.mock('../../api', () => ({ api: apiMock }))

// Test data
const USER_OFF_THE_CLOCK = {
  id: 'user-1',
  full_name: 'Alex Rivera',
  job_title: 'master_mechanic',
  clocked_in: false,
}
const USER_ON_THE_CLOCK = { ...USER_OFF_THE_CLOCK, clocked_in: true }
const USER_WITHOUT_TITLE = { ...USER_OFF_THE_CLOCK, job_title: null }

const WELCOME_TEXT = 'Welcome, Alex Rivera'
const JOB_TITLE_LABEL = 'Master Mechanic'
const CLOCKED_IN_MESSAGE = 'Clocked in!'
const CLOCKED_OUT_MESSAGE = 'Clocked out!'
const ALREADY_CLOCKED_IN_MESSAGE = 'user is already clocked in'

// Scenarios
function givenLoggedInAs(user) {
  useAuthMock.mockReturnValue({ user, logout: vi.fn(), refreshUser: refreshUserMock })
}

function givenClockInSucceeds() {
  apiMock.clockIn.mockResolvedValue({ id: 'entry-1' })
}

function givenClockInIsRejected(message) {
  apiMock.clockIn.mockRejectedValue(new Error(message))
}

function givenClockOutSucceeds() {
  apiMock.clockOut.mockResolvedValue({ id: 'entry-1' })
}

// Actions
function renderClockPanel() {
  return render(
    <MemoryRouter>
      <ClockPanel />
    </MemoryRouter>
  )
}

async function clickButton(name) {
  await userEvent.click(screen.getByRole('button', { name }))
}

describe('ClockPanel', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    refreshUserMock.mockReset()
    apiMock.clockIn.mockReset()
    apiMock.clockOut.mockReset()
  })

  describe('welcome message', () => {
    it('shows the welcome message with the display label for the job title', () => {
      givenLoggedInAs(USER_OFF_THE_CLOCK)

      renderClockPanel()

      expect(screen.getByText(WELCOME_TEXT)).toBeInTheDocument()
      expect(screen.getByText(JOB_TITLE_LABEL)).toBeInTheDocument()
    })

    it('shows no job title line for a user who has none', () => {
      givenLoggedInAs(USER_WITHOUT_TITLE)

      const { container } = renderClockPanel()

      expect(screen.getByText(WELCOME_TEXT)).toBeInTheDocument()
      expect(container.querySelector('.job-title')).toBeNull()
    })
  })

  describe('clock buttons', () => {
    it('offers only Clock In to a user who is off the clock', () => {
      givenLoggedInAs(USER_OFF_THE_CLOCK)

      renderClockPanel()

      expect(screen.getByRole('button', { name: 'Clock In' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Clock Out' })).not.toBeInTheDocument()
    })

    it('offers only Clock Out to a user who is on the clock', () => {
      givenLoggedInAs(USER_ON_THE_CLOCK)

      renderClockPanel()

      expect(screen.getByRole('button', { name: 'Clock Out' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Clock In' })).not.toBeInTheDocument()
    })

    it('clocks in, confirms it, and refreshes the user so the button can flip', async () => {
      givenLoggedInAs(USER_OFF_THE_CLOCK)
      givenClockInSucceeds()
      renderClockPanel()

      await clickButton('Clock In')

      expect(apiMock.clockIn).toHaveBeenCalledTimes(1)
      expect(await screen.findByText(CLOCKED_IN_MESSAGE)).toBeInTheDocument()
      expect(refreshUserMock).toHaveBeenCalledTimes(1)
    })

    it('clocks out, confirms it, and refreshes the user so the button can flip', async () => {
      givenLoggedInAs(USER_ON_THE_CLOCK)
      givenClockOutSucceeds()
      renderClockPanel()

      await clickButton('Clock Out')

      expect(apiMock.clockOut).toHaveBeenCalledTimes(1)
      expect(await screen.findByText(CLOCKED_OUT_MESSAGE)).toBeInTheDocument()
      expect(refreshUserMock).toHaveBeenCalledTimes(1)
    })

    it('shows the server message and does not refresh when clock in is rejected', async () => {
      givenLoggedInAs(USER_OFF_THE_CLOCK)
      givenClockInIsRejected(ALREADY_CLOCKED_IN_MESSAGE)
      renderClockPanel()

      await clickButton('Clock In')

      expect(await screen.findByText(ALREADY_CLOCKED_IN_MESSAGE)).toBeInTheDocument()
      expect(refreshUserMock).not.toHaveBeenCalled()
    })
  })
})
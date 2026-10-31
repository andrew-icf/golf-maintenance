import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FAILURE_MESSAGE } from '../../test/fixtures/asyncActionCases'
import {
  GATE_DIALOG_NAME,
  GATE_JOB_TITLE_LABEL,
  GATE_USER,
  LUKE_WEEK_ROWS,
  NEXT_WEEK_END,
  NEXT_WEEK_START,
  NEXT_WEEK_TODAY,
  NO_SUBTITLE_USER_CASES,
  SCHEDULE_FAILED_TEXT,
  SCHEDULE_LOADING_TEXT,
  SPLIT_ROW,
  TODAY_LINE_CASES,
  TODAY_ROW_LABEL,
  WEEK_REQUEST_CASES,
} from '../../test/fixtures/clockGateCases'
import { LUKE_WEEK_SHIFTS, SPLIT_DAY_SHIFTS, TODAY } from '../../test/fixtures/myShiftsCases'
import { createDeferred } from '../../test/helpers'
import { ClockGate } from './ClockGate'

const { apiMock } = vi.hoisted(() => ({
  apiMock: { getMySchedule: vi.fn() },
}))

vi.mock('../../api', () => ({ api: apiMock }))

// Actions
function renderGate({
  user = GATE_USER,
  today = TODAY,
  onClockIn = vi.fn().mockResolvedValue(),
  onLogout = vi.fn().mockResolvedValue(),
} = {}) {
  const view = render(
    <ClockGate user={ user } todayDate={ today } onClockIn={ onClockIn } onLogout={ onLogout } />
  )
  return { onClockIn, onLogout, ...view }
}

// Waits for the week list, which only appears once the schedule has loaded
async function renderLoadedGate({ shifts = LUKE_WEEK_SHIFTS, ...options } = {}) {
  apiMock.getMySchedule.mockResolvedValue(shifts)
  const view = renderGate(options)
  await screen.findAllByRole('listitem')
  return view
}

function clockInButton() {
  return screen.getByRole('button', { name: /clock(ing)? in/i })
}

function logOutButton() {
  return screen.getByRole('button', { name: /log(ging)? out/i })
}

function weekRows() {
  return screen.getAllByRole('listitem').map((row) => ({
    label: row.querySelector('.clock-gate-day-label').textContent,
    shifts: Array.from(row.querySelectorAll('.clock-gate-day-shifts > span')).map((span) => span.textContent),
  }))
}

describe('ClockGate', () => {
  beforeEach(() => {
    apiMock.getMySchedule.mockReset()
  })

  describe('the welcome', () => {
    it("names the dialog after the person and shows their job title", async () => {
      await renderLoadedGate()

      expect(screen.getByRole('dialog', { name: GATE_DIALOG_NAME })).toBeInTheDocument()
      expect(screen.getByText(GATE_JOB_TITLE_LABEL)).toBeInTheDocument()
    })

    it.each(NO_SUBTITLE_USER_CASES)('shows no line under the welcome for $label', async ({ user }) => {
      await renderLoadedGate({ user })

      expect(document.querySelector('.modal-subtitle')).toBeNull()
    })

    it('has no way to close it', async () => {
      await renderLoadedGate()

      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    })

    it('stays open when Escape is pressed', async () => {
      await renderLoadedGate()

      await userEvent.keyboard('{Escape}')

      expect(screen.getByRole('dialog', { name: GATE_DIALOG_NAME })).toBeInTheDocument()
    })
  })

  describe('loading the schedule', () => {
    it.each(WEEK_REQUEST_CASES)('asks for the calendar week around $label', async ({ today, start, end }) => {
      await renderLoadedGate({ today })

      expect(apiMock.getMySchedule).toHaveBeenCalledTimes(1)
      expect(apiMock.getMySchedule).toHaveBeenCalledWith(start, end)
    })

    it('asks for the new week when the date moves into the next one', async () => {
      apiMock.getMySchedule.mockResolvedValue([])
      const { rerender, onClockIn, onLogout } = renderGate()
      await screen.findAllByRole('listitem')

      rerender(
        <ClockGate user={ GATE_USER } todayDate={ NEXT_WEEK_TODAY } onClockIn={ onClockIn } onLogout={ onLogout } />
      )

      await waitFor(() => {
        expect(apiMock.getMySchedule).toHaveBeenCalledTimes(2)
      })
      expect(apiMock.getMySchedule).toHaveBeenLastCalledWith(NEXT_WEEK_START, NEXT_WEEK_END)
    })

    it('says it is loading, and can already clock in, until the schedule arrives', async () => {
      const schedule = createDeferred()
      apiMock.getMySchedule.mockReturnValue(schedule.promise)

      renderGate()

      expect(screen.getByText(SCHEDULE_LOADING_TEXT)).toBeInTheDocument()
      expect(screen.queryAllByRole('listitem')).toHaveLength(0)
      expect(clockInButton()).toBeEnabled()

      await act(async () => {
        schedule.resolve(LUKE_WEEK_SHIFTS)
      })

      expect(screen.queryByText(SCHEDULE_LOADING_TEXT)).not.toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(LUKE_WEEK_ROWS.length)
    })

    it('says so when the schedule cannot be loaded, and still lets the person clock in', async () => {
      apiMock.getMySchedule.mockRejectedValue(new Error('could not fetch schedule'))
      const { onClockIn } = renderGate()

      expect(await screen.findByText(SCHEDULE_FAILED_TEXT)).toBeInTheDocument()
      expect(screen.queryAllByRole('listitem')).toHaveLength(0)
      expect(screen.queryByText(SCHEDULE_LOADING_TEXT)).not.toBeInTheDocument()

      await userEvent.click(clockInButton())

      expect(onClockIn).toHaveBeenCalledTimes(1)
    })
  })

  describe("today and the week", () => {
    it.each(TODAY_LINE_CASES)('says what today holds for $label', async ({ shifts, today, expectedDate, expectedLine }) => {
      await renderLoadedGate({ shifts, today })

      expect(document.querySelector('.clock-gate-today-date').textContent).toBe(expectedDate)
      expect(document.querySelector('.clock-gate-today-line').textContent).toBe(expectedLine)
    })

    it('lists the seven days of the week in order, each with its shifts or Off', async () => {
      await renderLoadedGate()

      expect(weekRows()).toEqual(LUKE_WEEK_ROWS)
    })

    it('lists both shifts of a split day, in start-time order', async () => {
      await renderLoadedGate({ shifts: SPLIT_DAY_SHIFTS })

      expect(weekRows().find((row) => row.label === SPLIT_ROW.label)).toEqual(SPLIT_ROW)
    })

    it('marks only today in the week', async () => {
      await renderLoadedGate()

      const currentRows = screen
        .getAllByRole('listitem')
        .filter((row) => row.getAttribute('aria-current') === 'date')

      expect(currentRows).toHaveLength(1)
      expect(currentRows[0].querySelector('.clock-gate-day-label').textContent).toBe(TODAY_ROW_LABEL)
    })
  })

  describe('clocking in', () => {
    it('calls the clock-in action once when Clock in is used', async () => {
      const { onClockIn } = await renderLoadedGate()

      await userEvent.click(clockInButton())

      expect(onClockIn).toHaveBeenCalledTimes(1)
    })

    it('says it is clocking in, and ignores a second tap, while the request is on its way', async () => {
      const request = createDeferred()
      const { onClockIn } = await renderLoadedGate({ onClockIn: vi.fn().mockReturnValue(request.promise) })

      await userEvent.click(clockInButton())

      expect(screen.getByRole('button', { name: 'Clocking in...' })).toBeDisabled()
      await userEvent.click(screen.getByRole('button', { name: 'Clocking in...' }))
      expect(onClockIn).toHaveBeenCalledTimes(1)

      await act(async () => {
        request.resolve()
      })
      expect(screen.getByRole('button', { name: 'Clock in' })).toBeEnabled()
    })

    it('shows why it failed, and can be used again', async () => {
      await renderLoadedGate({ onClockIn: vi.fn().mockRejectedValue(new Error(FAILURE_MESSAGE)) })

      await userEvent.click(clockInButton())

      expect(await screen.findByRole('alert')).toHaveTextContent(FAILURE_MESSAGE)
      expect(screen.getByRole('button', { name: 'Clock in' })).toBeEnabled()
    })
  })

  describe('logging out', () => {
    it('calls the log-out action once when Log out is used', async () => {
      const { onLogout } = await renderLoadedGate()

      await userEvent.click(logOutButton())

      expect(onLogout).toHaveBeenCalledTimes(1)
    })

    it('shows why it failed, and can be used again', async () => {
      await renderLoadedGate({ onLogout: vi.fn().mockRejectedValue(new Error(FAILURE_MESSAGE)) })

      await userEvent.click(logOutButton())

      expect(await screen.findByRole('alert')).toHaveTextContent(FAILURE_MESSAGE)
      expect(screen.getByRole('button', { name: 'Log out' })).toBeEnabled()
    })
  })
})
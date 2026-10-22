import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScheduleView } from './ScheduleView'

const { apiMock, useAuthMock } = vi.hoisted(() => ({
  apiMock: { getRoster: vi.fn(), getSchedules: vi.fn() },
  useAuthMock: vi.fn(),
}))

vi.mock('../../api', () => ({ api: apiMock }))
vi.mock('../auth/AuthContext', () => ({ useAuth: useAuthMock }))

// A stand-in for the real modal, which has its own tests. It exposes the two
// props ScheduleView hands it, so these tests can check the wiring.
vi.mock('./AddShiftModal', async () => {
  const { createElement } = await import('react')
  return {
    AddShiftModal: ({ onShiftsAdded, onClose }) =>
      createElement(
        'div',
        { role: 'dialog', 'aria-label': 'Add shifts' },
        createElement('button', { onClick: onShiftsAdded }, 'Simulate shifts added'),
        createElement('button', { onClick: onClose }, 'Close modal')
      ),
  }
})

// Test data. Today is Wednesday 2026-10-21, so the displayed week runs Sunday 10/18 to Saturday 10/24.
const TODAY = new Date(2026, 9, 21, 12, 0)
const CURRENT_WEEK = { start: '2026-10-18', end: '2026-10-24', label: 'Oct 18 – Oct 24, 2026' }
const NEXT_WEEK = { start: '2026-10-25', end: '2026-10-31', label: 'Oct 25 – Oct 31, 2026' }
const PREVIOUS_WEEK = { start: '2026-10-11', end: '2026-10-17', label: 'Oct 11 – Oct 17, 2026' }
const LATE_DECEMBER_TODAY = new Date(2026, 11, 30, 12, 0)
const YEAR_END_WEEK = { start: '2026-12-27', end: '2027-01-02', label: 'Dec 27, 2026 – Jan 2, 2027' }

const HAN = { id: 'user-han', full_name: 'Han Solo', job_title: null }
const LEIA = { id: 'user-leia', full_name: 'Leia Organa', job_title: 'office_admin' }
const LUKE = { id: 'user-luke', full_name: 'Luke Skywalker', job_title: 'operator' }
const ROSTER = [HAN, LEIA, LUKE]

const ADMIN = { id: 'user-obi-wan', role: 'admin' }
const STAFF_LUKE = { id: LUKE.id, role: 'staff' }

function makeShift(id, person, date, startTime, endTime) {
  return {
    id,
    user_id: person.id,
    full_name: person.full_name,
    shift_date: date,
    start_time: startTime,
    end_time: endTime,
  }
}

const LUKE_MONDAY = makeShift('shift-1', LUKE, '2026-10-19', '06:00:00', '14:30:00')
const LEIA_THURSDAY = makeShift('shift-2', LEIA, '2026-10-22', '04:00:00', '13:00:00')
const LUKE_NEXT_WEEK = makeShift('shift-3', LUKE, '2026-10-26', '07:00:00', '15:30:00')
const LUKE_LAST_WEEK = makeShift('shift-4', LUKE, '2026-10-13', '05:30:00', '14:00:00')
const LEIA_NEW_SHIFT = makeShift('shift-5', LEIA, '2026-10-20', '17:00:00', '20:00:00')
const ALL_SHIFTS = [LUKE_LAST_WEEK, LUKE_MONDAY, LEIA_THURSDAY, LUKE_NEXT_WEEK]

// How each shift appears in the grid
const LUKE_MONDAY_TEXT = '6am – 2:30pm'
const LEIA_THURSDAY_TEXT = '4am – 1pm'
const LUKE_NEXT_WEEK_TEXT = '7am – 3:30pm'
const LUKE_LAST_WEEK_TEXT = '5:30am – 2pm'
const LEIA_NEW_SHIFT_TEXT = '5pm – 8pm'
const DAY_OFF_TEXT = '—'
const DAYS_IN_WEEK = 7
const MONDAY_COLUMN = 1
const THURSDAY_COLUMN = 4

const ROSTER_ERROR = 'could not fetch roster'
const SHIFTS_ERROR = 'could not fetch schedules'

function shiftsInRange(shifts, startDate, endDate) {
  return shifts.filter((shift) => shift.shift_date >= startDate && shift.shift_date <= endDate)
}

function createDeferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

// Scenarios
function givenLoggedInAs(user) {
  useAuthMock.mockReturnValue({ user })
}

function givenRoster() {
  apiMock.getRoster.mockResolvedValue(ROSTER)
}

// Behaves like the real endpoint: returns only the shifts inside the requested dates
function givenShifts(shifts) {
  apiMock.getSchedules.mockImplementation((startDate, endDate) =>
    Promise.resolve(shiftsInRange(shifts, startDate, endDate))
  )
}

// Actions
async function renderSchedule() {
  render(<ScheduleView />)
  await screen.findByText(CURRENT_WEEK.label)
}

async function renderLoadedSchedule() {
  await renderSchedule()
  await screen.findByText(LUKE_MONDAY_TEXT)
}

async function clickButton(name) {
  await userEvent.click(screen.getByRole('button', { name }))
}

function rowFor(person) {
  return screen.getByText(person.full_name).closest('tr')
}

function dayCells(person) {
  return within(rowFor(person)).getAllByRole('cell')
}

describe('ScheduleView', () => {
  beforeEach(() => {
    apiMock.getRoster.mockReset()
    apiMock.getSchedules.mockReset()
    useAuthMock.mockReset()
    // Only Date is faked, so timers and promises keep working normally
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(TODAY)
    givenLoggedInAs(ADMIN)
    givenRoster()
    givenShifts(ALL_SHIFTS)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('loading the schedule', () => {
    it('asks for the roster and for the current week, Sunday to Saturday', async () => {
      await renderLoadedSchedule()

      expect(apiMock.getRoster).toHaveBeenCalledTimes(1)
      expect(apiMock.getSchedules).toHaveBeenCalledWith(CURRENT_WEEK.start, CURRENT_WEEK.end)
    })

    it('puts each shift in its own employee row and day column', async () => {
      await renderLoadedSchedule()

      // Cells run Sunday to Saturday, so index 1 is Monday and index 4 is Thursday
      expect(dayCells(LUKE)[MONDAY_COLUMN]).toHaveTextContent(LUKE_MONDAY_TEXT)
      expect(dayCells(LEIA)[THURSDAY_COLUMN]).toHaveTextContent(LEIA_THURSDAY_TEXT)
      expect(dayCells(LEIA)[MONDAY_COLUMN]).not.toHaveTextContent(LUKE_MONDAY_TEXT)
    })

    it('gives an employee with no shifts a row of days off', async () => {
      await renderLoadedSchedule()

      const cells = dayCells(HAN)

      expect(cells).toHaveLength(DAYS_IN_WEEK)
      for (const cell of cells) {
        expect(cell).toHaveTextContent(DAY_OFF_TEXT)
      }
    })

    it('shows only the displayed week, not shifts from the weeks around it', async () => {
      await renderLoadedSchedule()

      expect(screen.queryByText(LUKE_NEXT_WEEK_TEXT)).not.toBeInTheDocument()
      expect(screen.queryByText(LUKE_LAST_WEEK_TEXT)).not.toBeInTheDocument()
    })

    it('shows a loading message until the roster arrives', async () => {
      const roster = createDeferred()
      apiMock.getRoster.mockReturnValue(roster.promise)

      render(<ScheduleView />)

      expect(screen.getByText('Loading schedule...')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Next week' })).not.toBeInTheDocument()

      await act(async () => {
        roster.resolve(ROSTER)
      })

      expect(await screen.findByText(CURRENT_WEEK.label)).toBeInTheDocument()
    })

    it('shows the toolbar with a loading message while the shifts are on the way', async () => {
      const shifts = createDeferred()
      apiMock.getSchedules.mockReturnValue(shifts.promise)

      await renderSchedule()

      expect(screen.getByText('Loading week...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next week' })).toBeEnabled()
    })

    it('shows the week that spans the new year when today is in late December', async () => {
      vi.setSystemTime(LATE_DECEMBER_TODAY)

      render(<ScheduleView />)

      expect(await screen.findByText(YEAR_END_WEEK.label)).toBeInTheDocument()
      expect(apiMock.getSchedules).toHaveBeenCalledWith(YEAR_END_WEEK.start, YEAR_END_WEEK.end)
    })
  })

  describe('week navigation', () => {
    it('moves to the next week and shows that week', async () => {
      await renderLoadedSchedule()

      await clickButton('Next week')

      expect(await screen.findByText(NEXT_WEEK.label)).toBeInTheDocument()
      expect(await screen.findByText(LUKE_NEXT_WEEK_TEXT)).toBeInTheDocument()
      expect(apiMock.getSchedules).toHaveBeenLastCalledWith(NEXT_WEEK.start, NEXT_WEEK.end)
      expect(screen.queryByText(LUKE_MONDAY_TEXT)).not.toBeInTheDocument()
    })

    it('moves to the previous week and shows that week', async () => {
      await renderLoadedSchedule()

      await clickButton('Previous week')

      expect(await screen.findByText(PREVIOUS_WEEK.label)).toBeInTheDocument()
      expect(await screen.findByText(LUKE_LAST_WEEK_TEXT)).toBeInTheDocument()
      expect(apiMock.getSchedules).toHaveBeenLastCalledWith(PREVIOUS_WEEK.start, PREVIOUS_WEEK.end)
      expect(screen.queryByText(LUKE_MONDAY_TEXT)).not.toBeInTheDocument()
    })

    it('returns to the current week with This week, which is disabled while already on it', async () => {
      await renderLoadedSchedule()
      expect(screen.getByRole('button', { name: 'This week' })).toBeDisabled()

      await clickButton('Next week')
      await screen.findByText(NEXT_WEEK.label)
      expect(screen.getByRole('button', { name: 'This week' })).toBeEnabled()

      await clickButton('This week')

      expect(await screen.findByText(CURRENT_WEEK.label)).toBeInTheDocument()
      expect(await screen.findByText(LUKE_MONDAY_TEXT)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'This week' })).toBeDisabled()
    })

    it('ignores a slow response for a week that has already been left behind', async () => {
      const slowCurrentWeek = createDeferred()
      apiMock.getSchedules.mockImplementation((startDate, endDate) =>
        startDate === CURRENT_WEEK.start
          ? slowCurrentWeek.promise
          : Promise.resolve(shiftsInRange(ALL_SHIFTS, startDate, endDate))
      )
      await renderSchedule()
      await clickButton('Next week')
      expect(await screen.findByText(LUKE_NEXT_WEEK_TEXT)).toBeInTheDocument()

      // The first week's answer finally arrives, after the admin has moved on
      await act(async () => {
        slowCurrentWeek.resolve(shiftsInRange(ALL_SHIFTS, CURRENT_WEEK.start, CURRENT_WEEK.end))
      })

      expect(screen.getByText(NEXT_WEEK.label)).toBeInTheDocument()
      expect(screen.getByText(LUKE_NEXT_WEEK_TEXT)).toBeInTheDocument()
      expect(screen.queryByText(LUKE_MONDAY_TEXT)).not.toBeInTheDocument()
      expect(screen.queryByText('Loading week...')).not.toBeInTheDocument()
    })
  })

  describe('errors', () => {
    it('shows only the error when the roster cannot be loaded', async () => {
      apiMock.getRoster.mockRejectedValue(new Error(ROSTER_ERROR))

      render(<ScheduleView />)

      expect(await screen.findByText(ROSTER_ERROR)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Next week' })).not.toBeInTheDocument()
    })

    it('shows a shifts error under the toolbar, and clears it when moving to another week', async () => {
      apiMock.getSchedules.mockRejectedValueOnce(new Error(SHIFTS_ERROR))
      await renderSchedule()
      expect(await screen.findByText(SHIFTS_ERROR)).toBeInTheDocument()
      expect(screen.queryByText('Loading week...')).not.toBeInTheDocument()

      await clickButton('Next week')

      expect(await screen.findByText(LUKE_NEXT_WEEK_TEXT)).toBeInTheDocument()
      expect(screen.queryByText(SHIFTS_ERROR)).not.toBeInTheDocument()
    })
  })

  describe('who sees what', () => {
    it('shows the Add shift button to an admin', async () => {
      await renderLoadedSchedule()

      expect(screen.getByRole('button', { name: '+ Add shift' })).toBeInTheDocument()
    })

    it('hides the Add shift button from a staff member', async () => {
      givenLoggedInAs(STAFF_LUKE)

      await renderLoadedSchedule()

      expect(screen.queryByRole('button', { name: '+ Add shift' })).not.toBeInTheDocument()
    })

    it('highlights the logged-in staff member\'s own row and no other', async () => {
      givenLoggedInAs(STAFF_LUKE)

      await renderLoadedSchedule()

      expect(rowFor(LUKE)).toHaveClass('current-user')
      expect(rowFor(LEIA)).not.toHaveClass('current-user')
    })

    it('highlights no row for an admin, who is not on the roster', async () => {
      await renderLoadedSchedule()

      const highlightedRows = screen
        .getAllByRole('row')
        .filter((row) => row.classList.contains('current-user'))

      expect(highlightedRows).toHaveLength(0)
    })
  })

  describe('adding shifts', () => {
    it('opens the add shift dialog from the button and closes it again', async () => {
      await renderLoadedSchedule()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await clickButton('+ Add shift')
      expect(screen.getByRole('dialog', { name: 'Add shifts' })).toBeInTheDocument()

      await clickButton('Close modal')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('reloads the same week when shifts are added, and keeps the dialog open', async () => {
      await renderLoadedSchedule()
      await clickButton('+ Add shift')
      givenShifts([...ALL_SHIFTS, LEIA_NEW_SHIFT])

      await clickButton('Simulate shifts added')

      expect(await screen.findByText(LEIA_NEW_SHIFT_TEXT)).toBeInTheDocument()
      expect(apiMock.getSchedules).toHaveBeenCalledTimes(2)
      expect(apiMock.getSchedules).toHaveBeenLastCalledWith(CURRENT_WEEK.start, CURRENT_WEEK.end)
      expect(screen.getByRole('dialog', { name: 'Add shifts' })).toBeInTheDocument()
    })

    it('keeps showing the grid while the reload is on its way', async () => {
      await renderLoadedSchedule()
      await clickButton('+ Add shift')
      const reload = createDeferred()
      apiMock.getSchedules.mockReturnValue(reload.promise)

      await clickButton('Simulate shifts added')

      expect(screen.getByText(LUKE_MONDAY_TEXT)).toBeInTheDocument()
      expect(screen.queryByText('Loading week...')).not.toBeInTheDocument()

      await act(async () => {
        reload.resolve(
          shiftsInRange([...ALL_SHIFTS, LEIA_NEW_SHIFT], CURRENT_WEEK.start, CURRENT_WEEK.end)
        )
      })

      expect(screen.getByText(LEIA_NEW_SHIFT_TEXT)).toBeInTheDocument()
    })
  })
})
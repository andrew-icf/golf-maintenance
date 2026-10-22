import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddShiftModal } from './AddShiftModal'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getUsers: vi.fn(),
    createSchedule: vi.fn(),
    repeatSchedule: vi.fn(),
  },
}))

vi.mock('../../api', () => ({ api: apiMock }))

// Test data
const EMPLOYEES = [
  { id: 'user-luke', full_name: 'Luke Skywalker', role: 'staff' },
  { id: 'user-leia', full_name: 'Leia Organa', role: 'staff' },
]
const VALID_SHIFT = {
  userId: 'user-luke',
  date: '2026-10-26',
  startTime: '04:00',
  endTime: '13:00',
}
const DAY_BUTTON_LABELS = ['Mon', 'Tue', 'Wed', 'Thu']

// Two weeks of Monday to Thursday shifts
const EIGHT_DATES = [
  '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29',
  '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05',
]

// What the server sends back for a repeat request
const REPEAT_ALL_NEW = { created: EIGHT_DATES, skipped: null }
const REPEAT_SOME_SKIPPED = { created: EIGHT_DATES.slice(0, 6), skipped: EIGHT_DATES.slice(6) }
const REPEAT_ONE_SKIPPED = { created: EIGHT_DATES.slice(0, 7), skipped: EIGHT_DATES.slice(7) }
const REPEAT_ALL_SKIPPED = { created: null, skipped: EIGHT_DATES }
const REPEAT_ONE_CREATED = { created: EIGHT_DATES.slice(0, 1), skipped: null }

const CONFIRMATION_CASES = [
  { label: 'all new shifts', apiResult: REPEAT_ALL_NEW, headline: '8 shifts added', detail: null },
  {
    label: 'some dates already scheduled',
    apiResult: REPEAT_SOME_SKIPPED,
    headline: '6 shifts added',
    detail: '2 shifts skipped (already scheduled)',
  },
  {
    label: 'exactly one date already scheduled',
    apiResult: REPEAT_ONE_SKIPPED,
    headline: '7 shifts added',
    detail: '1 shift skipped (already scheduled)',
  },
  {
    label: 'every date already scheduled',
    apiResult: REPEAT_ALL_SKIPPED,
    headline: 'No new shifts added',
    detail: '8 shifts skipped (already scheduled)',
  },
  { label: 'a single new shift', apiResult: REPEAT_ONE_CREATED, headline: '1 shift added', detail: null },
]

const ONE_OFF_HEADLINE = '1 shift added'
const SERVER_ERROR_MESSAGE = 'user not found'
const SKIPPED_PATTERN = /skipped/

// Scenarios
function givenEmployeesExist() {
  apiMock.getUsers.mockResolvedValue(EMPLOYEES)
}

function givenCreateShiftSucceeds() {
  apiMock.createSchedule.mockResolvedValue({ id: 'shift-1' })
}

function givenCreateShiftFails(message) {
  apiMock.createSchedule.mockRejectedValue(new Error(message))
}

function givenRepeatSucceeds(result) {
  apiMock.repeatSchedule.mockResolvedValue(result)
}

// Actions
async function waitForEmployees() {
  await screen.findByRole('option', { name: EMPLOYEES[0].full_name })
}

async function renderModal() {
  const onShiftsAdded = vi.fn()
  const onClose = vi.fn()
  render(<AddShiftModal onShiftsAdded={ onShiftsAdded } onClose={ onClose } />)
  await waitForEmployees()
  return { onShiftsAdded, onClose }
}

// Date and time inputs are simulated by jsdom, so setting the value directly
// is more reliable than simulating keystrokes.
function setField(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

async function fillShiftDetails({ userId, date, startTime, endTime }) {
  await userEvent.selectOptions(screen.getByLabelText('Employee'), userId)
  setField(/date/i, date)
  setField('Start', startTime)
  setField('End', endTime)
}

async function clickButton(name) {
  await userEvent.click(screen.getByRole('button', { name }))
}

async function submitOneOffShift() {
  await fillShiftDetails(VALID_SHIFT)
  await clickButton('Add shift')
}

async function submitRepeatingPattern() {
  await clickButton('Repeat weekly')
  await fillShiftDetails(VALID_SHIFT)
  for (const dayLabel of DAY_BUTTON_LABELS) {
    await clickButton(dayLabel)
  }
  await clickButton('Add shifts')
}

describe('AddShiftModal', () => {
  beforeEach(() => {
    apiMock.getUsers.mockReset()
    apiMock.createSchedule.mockReset()
    apiMock.repeatSchedule.mockReset()
    givenEmployeesExist()
  })

  it('opens on the form, with no confirmation showing', async () => {
    const { onShiftsAdded } = await renderModal()

    expect(screen.getByRole('dialog', { name: 'Add shifts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add shift' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument()
    expect(onShiftsAdded).not.toHaveBeenCalled()
  })

  describe('after a one-off shift', () => {
    it('replaces the form with a confirmation and refreshes the schedule', async () => {
      givenCreateShiftSucceeds()
      const { onShiftsAdded, onClose } = await renderModal()

      await submitOneOffShift()

      expect(await screen.findByText(ONE_OFF_HEADLINE)).toBeInTheDocument()
      expect(screen.queryByLabelText('Employee')).not.toBeInTheDocument()
      expect(onShiftsAdded).toHaveBeenCalledTimes(1)
      expect(onClose).not.toHaveBeenCalled()
    })

    it('announces the result to screen readers', async () => {
      givenCreateShiftSucceeds()
      await renderModal()

      await submitOneOffShift()

      expect(await screen.findByRole('status')).toHaveTextContent(ONE_OFF_HEADLINE)
    })
  })

  describe('after a repeating pattern', () => {
    it.each(CONFIRMATION_CASES)('words the confirmation for $label', async ({ apiResult, headline, detail }) => {
      givenRepeatSucceeds(apiResult)
      await renderModal()

      await submitRepeatingPattern()

      expect(await screen.findByText(headline)).toBeInTheDocument()
      if (detail) {
        expect(screen.getByText(detail)).toBeInTheDocument()
      } else {
        expect(screen.queryByText(SKIPPED_PATTERN)).not.toBeInTheDocument()
      }
    })
  })

  describe('from the confirmation', () => {
    it('closes the modal when Done is clicked', async () => {
      givenCreateShiftSucceeds()
      const { onClose } = await renderModal()
      await submitOneOffShift()
      await screen.findByText(ONE_OFF_HEADLINE)

      await clickButton('Done')

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('moves focus to Done so the keyboard can finish straight away', async () => {
      givenCreateShiftSucceeds()
      await renderModal()

      await submitOneOffShift()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus()
      })
    })

    it('brings back a completely empty form when Add another is clicked', async () => {
      givenRepeatSucceeds(REPEAT_ALL_NEW)
      const { onClose } = await renderModal()
      await submitRepeatingPattern()
      await screen.findByText('8 shifts added')

      await clickButton('Add another')
      await waitForEmployees()

      expect(screen.getByLabelText('Employee')).toHaveValue('')
      expect(screen.getByLabelText(/date/i)).toHaveValue('')
      // Back in one-off mode, not still in repeat mode
      expect(screen.queryByRole('button', { name: 'Mon' })).not.toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(onClose).not.toHaveBeenCalled()
    })

    it('lets a second batch be added after Add another', async () => {
      givenCreateShiftSucceeds()
      const { onShiftsAdded } = await renderModal()
      await submitOneOffShift()
      await screen.findByText(ONE_OFF_HEADLINE)
      await clickButton('Add another')
      await waitForEmployees()

      await submitOneOffShift()

      expect(await screen.findByText(ONE_OFF_HEADLINE)).toBeInTheDocument()
      expect(apiMock.createSchedule).toHaveBeenCalledTimes(2)
      expect(onShiftsAdded).toHaveBeenCalledTimes(2)
    })
  })

  it('stays on the form with the server error, keeping what was typed, when saving fails', async () => {
    givenCreateShiftFails(SERVER_ERROR_MESSAGE)
    const { onShiftsAdded } = await renderModal()

    await submitOneOffShift()

    expect(await screen.findByText(SERVER_ERROR_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/date/i)).toHaveValue(VALID_SHIFT.date)
    expect(onShiftsAdded).not.toHaveBeenCalled()
  })
})
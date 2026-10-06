import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateShiftForm } from './CreateShiftForm'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getUsers: vi.fn(),
    createSchedule: vi.fn(),
    repeatSchedule: vi.fn(),
  },
}))

vi.mock('../api', () => ({ api: apiMock }))

// Test data
const EMPLOYEES = [
  { id: 'user-1', full_name: 'Alex Rivera', role: 'staff' },
  { id: 'user-2', full_name: 'Sam Okafor', role: 'staff' },
]
const VALID_SHIFT = {
  userId: 'user-1',
  date: '2026-10-05',
  startTime: '07:00',
  endTime: '15:00',
}
const END_BEFORE_START_SHIFT = { ...VALID_SHIFT, startTime: '15:00', endTime: '07:00' }

const REPEAT_WEEKS = '3'
const DAY_BUTTON_LABELS = ['Mon', 'Wed', 'Fri']
const EXPECTED_DAY_NAMES = ['monday', 'wednesday', 'friday']
const REPEAT_RESULT_WITH_SKIPS = { created: ['2026-10-05', '2026-10-07'], skipped: ['2026-10-09'] }
const REPEAT_RESULT_NO_SKIPS = { created: ['2026-10-05'], skipped: null }

const END_BEFORE_START_MESSAGE = 'End time must be after start time'
const NO_DAYS_MESSAGE = 'Select at least one day of the week'
const SERVER_ERROR_MESSAGE = 'user not found'

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
async function renderForm() {
  const onCreated = vi.fn()
  render(<CreateShiftForm onCreated={ onCreated } />)
  await screen.findByRole('option', { name: EMPLOYEES[0].full_name })
  return onCreated
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

async function switchToRepeatMode() {
  await clickButton('Repeat weekly')
}

describe('CreateShiftForm', () => {
  beforeEach(() => {
    apiMock.getUsers.mockReset()
    apiMock.createSchedule.mockReset()
    apiMock.repeatSchedule.mockReset()
    givenEmployeesExist()
  })

  describe('one-off shifts', () => {
    it('lists the employees returned by the server', async () => {
      await renderForm()

      expect(screen.getByRole('option', { name: EMPLOYEES[1].full_name })).toBeInTheDocument()
    })

    it('creates the shift with the entered details and notifies the parent', async () => {
      givenCreateShiftSucceeds()
      const onCreated = await renderForm()

      await fillShiftDetails(VALID_SHIFT)
      await clickButton('Add shift')

      expect(apiMock.createSchedule).toHaveBeenCalledWith({
        user_id: VALID_SHIFT.userId,
        shift_date: VALID_SHIFT.date,
        start_time: VALID_SHIFT.startTime,
        end_time: VALID_SHIFT.endTime,
      })
      await waitFor(() => {
        expect(onCreated).toHaveBeenCalledTimes(1)
        expect(screen.getByLabelText(/date/i)).toHaveValue('')
      })
    })

    it('blocks submission when the end time is not after the start time', async () => {
      const onCreated = await renderForm()

      await fillShiftDetails(END_BEFORE_START_SHIFT)
      await clickButton('Add shift')

      expect(await screen.findByText(END_BEFORE_START_MESSAGE)).toBeInTheDocument()
      expect(apiMock.createSchedule).not.toHaveBeenCalled()
      expect(onCreated).not.toHaveBeenCalled()
    })

    it('shows the server error when creating the shift fails', async () => {
      givenCreateShiftFails(SERVER_ERROR_MESSAGE)
      const onCreated = await renderForm()

      await fillShiftDetails(VALID_SHIFT)
      await clickButton('Add shift')

      expect(await screen.findByText(SERVER_ERROR_MESSAGE)).toBeInTheDocument()
      expect(onCreated).not.toHaveBeenCalled()
    })
  })

  describe('repeat weekly mode', () => {
    it('only shows the day picker once repeat mode is selected', async () => {
      await renderForm()
      expect(screen.queryByRole('button', { name: 'Mon' })).not.toBeInTheDocument()

      await switchToRepeatMode()

      expect(screen.getByRole('button', { name: 'Mon' })).toBeInTheDocument()
    })

    it('sends the pattern with the selected days and week count', async () => {
      givenRepeatSucceeds(REPEAT_RESULT_WITH_SKIPS)
      const onCreated = await renderForm()
      await switchToRepeatMode()

      await fillShiftDetails(VALID_SHIFT)
      setField('Repeat for how many weeks', REPEAT_WEEKS)
      for (const dayLabel of DAY_BUTTON_LABELS) {
        await clickButton(dayLabel)
      }
      await clickButton('Add shifts')

      expect(apiMock.repeatSchedule).toHaveBeenCalledWith({
        user_id: VALID_SHIFT.userId,
        start_date: VALID_SHIFT.date,
        weeks: Number(REPEAT_WEEKS),
        days: EXPECTED_DAY_NAMES,
        start_time: VALID_SHIFT.startTime,
        end_time: VALID_SHIFT.endTime,
      })
      expect(apiMock.createSchedule).not.toHaveBeenCalled()
      expect(
        await screen.findByText('Added 2 shift(s), skipped 1 (already scheduled).')
      ).toBeInTheDocument()
      expect(onCreated).toHaveBeenCalledTimes(1)
    })

    it('requires at least one day to be selected', async () => {
      await renderForm()
      await switchToRepeatMode()

      await fillShiftDetails(VALID_SHIFT)
      await clickButton('Add shifts')

      expect(await screen.findByText(NO_DAYS_MESSAGE)).toBeInTheDocument()
      expect(apiMock.repeatSchedule).not.toHaveBeenCalled()
    })

    it('removes a day from the pattern when it is clicked a second time', async () => {
      givenRepeatSucceeds(REPEAT_RESULT_NO_SKIPS)
      await renderForm()
      await switchToRepeatMode()

      await fillShiftDetails(VALID_SHIFT)
      await clickButton('Mon')
      await clickButton('Wed')
      await clickButton('Mon')
      await clickButton('Add shifts')

      expect(apiMock.repeatSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ days: ['wednesday'] })
      )
    })

    it('handles a server response where nothing was skipped', async () => {
      givenRepeatSucceeds(REPEAT_RESULT_NO_SKIPS)
      await renderForm()
      await switchToRepeatMode()

      await fillShiftDetails(VALID_SHIFT)
      await clickButton('Mon')
      await clickButton('Add shifts')

      expect(await screen.findByText('Added 1 shift(s).')).toBeInTheDocument()
    })
  })
})
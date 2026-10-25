import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShiftEditor } from './ShiftEditor'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    updateSchedule: vi.fn(),
    deleteSchedules: vi.fn(),
    createSchedule: vi.fn(),
  },
}))

vi.mock('../../api', () => ({ api: apiMock }))

// Test data. 2026-10-20 is a Tuesday.
const LUKE = { id: 'user-luke', full_name: 'Luke Skywalker' }
const DATE = '2026-10-20'
const DAY_SUBTITLE = 'Tue 10/20'

// Shifts as the API sends them, with seconds
const EARLY_SHIFT = { id: 'shift-early', start_time: '04:00:00', end_time: '13:00:00' }
const EVENING_SHIFT = { id: 'shift-evening', start_time: '17:00:00', end_time: '20:00:00' }

// The same shifts as the editor shows and sends them, without seconds
const EARLY_SHIFT_AS_INPUT = { startTime: '04:00', endTime: '13:00' }
const EVENING_SHIFT_AS_INPUT = { startTime: '17:00', endTime: '20:00' }

const EDITED_TIMES = { startTime: '05:00', endTime: '16:00' }
const NEW_SHIFT_TIMES = { startTime: '07:30', endTime: '15:30' }
const DEFAULT_NEW_SHIFT_TIMES = { startTime: '06:00', endTime: '14:00' }

const BAD_RANGE_CASES = [
  { label: 'before the start time', startTime: '15:00', endTime: '07:00' },
  { label: 'equal to the start time', startTime: '08:00', endTime: '08:00' },
]

const END_BEFORE_START_MESSAGE = 'End time must be after start time'
const SERVER_ERROR_MESSAGE = 'shift not found'
const NO_SHIFTS_MESSAGE = 'No shifts this day.'

function createDeferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

// Scenarios
function givenUpdateSucceeds() {
  apiMock.updateSchedule.mockResolvedValue({ message: 'shift updated' })
}

function givenUpdateFails(message) {
  apiMock.updateSchedule.mockRejectedValue(new Error(message))
}

function givenDeleteSucceeds() {
  apiMock.deleteSchedules.mockResolvedValue({ deleted: 1 })
}

function givenDeleteFails(message) {
  apiMock.deleteSchedules.mockRejectedValue(new Error(message))
}

function givenCreateSucceeds() {
  apiMock.createSchedule.mockResolvedValue({ id: 'new-shift' })
}

function givenCreateFails(message) {
  apiMock.createSchedule.mockRejectedValue(new Error(message))
}

// Actions
function renderEditor({ shifts = [] } = {}) {
  const onChanged = vi.fn()
  const onClose = vi.fn()
  render(
    <ShiftEditor
      employee={ LUKE }
      date={ DATE }
      shifts={ shifts }
      onChanged={ onChanged }
      onClose={ onClose }
    />
  )
  return { onChanged, onClose }
}

// Each shift, and the add form, is its own section, and every section has its own buttons
function sectionFor(title) {
  return within(screen.getByText(title).closest('.editor-section'))
}

// Time inputs are simulated by jsdom, so setting the value directly
// is more reliable than simulating keystrokes.
function setTimes(label, { startTime, endTime }) {
  fireEvent.change(screen.getByLabelText(`${label} start time`), { target: { value: startTime } })
  fireEvent.change(screen.getByLabelText(`${label} end time`), { target: { value: endTime } })
}

async function clickIn(sectionTitle, buttonName) {
  await userEvent.click(sectionFor(sectionTitle).getByRole('button', { name: buttonName }))
}

describe('ShiftEditor', () => {
  beforeEach(() => {
    apiMock.updateSchedule.mockReset()
    apiMock.deleteSchedules.mockReset()
    apiMock.createSchedule.mockReset()
  })

  describe('what it shows', () => {
    it('names the dialog after the employee and shows the weekday and date', () => {
      renderEditor()

      expect(screen.getByRole('dialog', { name: LUKE.full_name })).toBeInTheDocument()
      expect(screen.getByText(DAY_SUBTITLE)).toBeInTheDocument()
    })

    it('says the day is empty, and offers only the add section, when there are no shifts', () => {
      renderEditor()

      expect(screen.getByText(NO_SHIFTS_MESSAGE)).toBeInTheDocument()
      expect(screen.queryByText('Shift 1')).not.toBeInTheDocument()
      expect(screen.getByText('Add a shift')).toBeInTheDocument()
    })

    it('shows each shift in its own section with its times trimmed to hours and minutes', () => {
      renderEditor({ shifts: [EARLY_SHIFT, EVENING_SHIFT] })

      expect(screen.getByLabelText('Shift 1 start time')).toHaveValue(EARLY_SHIFT_AS_INPUT.startTime)
      expect(screen.getByLabelText('Shift 1 end time')).toHaveValue(EARLY_SHIFT_AS_INPUT.endTime)
      expect(screen.getByLabelText('Shift 2 start time')).toHaveValue(EVENING_SHIFT_AS_INPUT.startTime)
      expect(screen.getByLabelText('Shift 2 end time')).toHaveValue(EVENING_SHIFT_AS_INPUT.endTime)
      expect(screen.queryByText(NO_SHIFTS_MESSAGE)).not.toBeInTheDocument()
    })
  })

  describe('editing a shift', () => {
    it('saves unchanged times in the short HH:MM format the API expects', async () => {
      givenUpdateSucceeds()
      renderEditor({ shifts: [EARLY_SHIFT] })

      await clickIn('Shift 1', 'Save')

      expect(apiMock.updateSchedule).toHaveBeenCalledWith(EARLY_SHIFT.id, {
        shift_date: DATE,
        start_time: EARLY_SHIFT_AS_INPUT.startTime,
        end_time: EARLY_SHIFT_AS_INPUT.endTime,
      })
    })

    it('saves the edited times against that shift and reports the change', async () => {
      givenUpdateSucceeds()
      const { onChanged } = renderEditor({ shifts: [EARLY_SHIFT] })
      setTimes('Shift 1', EDITED_TIMES)

      await clickIn('Shift 1', 'Save')

      expect(apiMock.updateSchedule).toHaveBeenCalledWith(EARLY_SHIFT.id, {
        shift_date: DATE,
        start_time: EDITED_TIMES.startTime,
        end_time: EDITED_TIMES.endTime,
      })
      await waitFor(() => {
        expect(onChanged).toHaveBeenCalledTimes(1)
      })
    })

    it("keeps one shift's edits out of the other shifts", async () => {
      givenUpdateSucceeds()
      renderEditor({ shifts: [EARLY_SHIFT, EVENING_SHIFT] })
      setTimes('Shift 1', EDITED_TIMES)

      await clickIn('Shift 2', 'Save')

      expect(apiMock.updateSchedule).toHaveBeenCalledTimes(1)
      expect(apiMock.updateSchedule).toHaveBeenCalledWith(EVENING_SHIFT.id, {
        shift_date: DATE,
        start_time: EVENING_SHIFT_AS_INPUT.startTime,
        end_time: EVENING_SHIFT_AS_INPUT.endTime,
      })
      expect(screen.getByLabelText('Shift 1 start time')).toHaveValue(EDITED_TIMES.startTime)
    })

    it.each(BAD_RANGE_CASES)('refuses to save an end time $label', async ({ startTime, endTime }) => {
      const { onChanged } = renderEditor({ shifts: [EARLY_SHIFT] })
      setTimes('Shift 1', { startTime, endTime })

      await clickIn('Shift 1', 'Save')

      expect(await screen.findByText(END_BEFORE_START_MESSAGE)).toBeInTheDocument()
      expect(apiMock.updateSchedule).not.toHaveBeenCalled()
      expect(onChanged).not.toHaveBeenCalled()
    })

    it('shows the server error and does not report a change when saving fails', async () => {
      givenUpdateFails(SERVER_ERROR_MESSAGE)
      const { onChanged } = renderEditor({ shifts: [EARLY_SHIFT] })

      await clickIn('Shift 1', 'Save')

      expect(await screen.findByText(SERVER_ERROR_MESSAGE)).toBeInTheDocument()
      expect(onChanged).not.toHaveBeenCalled()
      await waitFor(() => {
        expect(sectionFor('Shift 1').getByRole('button', { name: 'Save' })).toBeEnabled()
      })
    })

    it('disables the buttons while a save is on its way, so it cannot be sent twice', async () => {
      const save = createDeferred()
      apiMock.updateSchedule.mockReturnValue(save.promise)
      const { onChanged } = renderEditor({ shifts: [EARLY_SHIFT] })

      await clickIn('Shift 1', 'Save')

      const section = sectionFor('Shift 1')
      expect(section.getByRole('button', { name: 'Save' })).toBeDisabled()
      expect(section.getByRole('button', { name: 'Delete' })).toBeDisabled()

      await act(async () => {
        save.resolve({})
      })

      expect(onChanged).toHaveBeenCalledTimes(1)
      expect(section.getByRole('button', { name: 'Save' })).toBeEnabled()
    })
  })

  describe('deleting a shift', () => {
    it('asks for confirmation first, and Cancel backs out without deleting', async () => {
      renderEditor({ shifts: [EARLY_SHIFT] })

      await clickIn('Shift 1', 'Delete')

      const section = sectionFor('Shift 1')
      expect(section.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument()
      expect(section.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
      expect(apiMock.deleteSchedules).not.toHaveBeenCalled()

      await clickIn('Shift 1', 'Cancel')

      expect(section.getByRole('button', { name: 'Save' })).toBeInTheDocument()
      expect(section.queryByRole('button', { name: 'Confirm delete' })).not.toBeInTheDocument()
      expect(apiMock.deleteSchedules).not.toHaveBeenCalled()
    })

    it('asks for confirmation only on the shift whose Delete was clicked', async () => {
      renderEditor({ shifts: [EARLY_SHIFT, EVENING_SHIFT] })

      await clickIn('Shift 2', 'Delete')

      const otherSection = sectionFor('Shift 1')
      expect(otherSection.getByRole('button', { name: 'Save' })).toBeInTheDocument()
      expect(otherSection.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
      expect(otherSection.queryByRole('button', { name: 'Confirm delete' })).not.toBeInTheDocument()
    })

    it('deletes only that shift once confirmed and reports the change', async () => {
      givenDeleteSucceeds()
      const { onChanged } = renderEditor({ shifts: [EARLY_SHIFT, EVENING_SHIFT] })

      await clickIn('Shift 2', 'Delete')
      await clickIn('Shift 2', 'Confirm delete')

      expect(apiMock.deleteSchedules).toHaveBeenCalledTimes(1)
      expect(apiMock.deleteSchedules).toHaveBeenCalledWith([EVENING_SHIFT.id])
      expect(apiMock.updateSchedule).not.toHaveBeenCalled()
      await waitFor(() => {
        expect(onChanged).toHaveBeenCalledTimes(1)
      })
    })

    it('shows the server error and does not report a change when deleting fails', async () => {
      givenDeleteFails(SERVER_ERROR_MESSAGE)
      const { onChanged } = renderEditor({ shifts: [EARLY_SHIFT] })

      await clickIn('Shift 1', 'Delete')
      await clickIn('Shift 1', 'Confirm delete')

      expect(await screen.findByText(SERVER_ERROR_MESSAGE)).toBeInTheDocument()
      expect(onChanged).not.toHaveBeenCalled()
    })
  })

  describe('adding a shift', () => {
    it('starts the new shift at 6am to 2pm', () => {
      renderEditor()

      expect(screen.getByLabelText('New shift start time')).toHaveValue(DEFAULT_NEW_SHIFT_TIMES.startTime)
      expect(screen.getByLabelText('New shift end time')).toHaveValue(DEFAULT_NEW_SHIFT_TIMES.endTime)
    })

    it('creates a shift for this employee on this date with the entered times and reports the change', async () => {
      givenCreateSucceeds()
      const { onChanged } = renderEditor({ shifts: [EARLY_SHIFT] })
      setTimes('New shift', NEW_SHIFT_TIMES)

      await clickIn('Add a shift', 'Add shift')

      expect(apiMock.createSchedule).toHaveBeenCalledWith({
        user_id: LUKE.id,
        shift_date: DATE,
        start_time: NEW_SHIFT_TIMES.startTime,
        end_time: NEW_SHIFT_TIMES.endTime,
      })
      await waitFor(() => {
        expect(onChanged).toHaveBeenCalledTimes(1)
      })
    })

    it.each(BAD_RANGE_CASES)('refuses to add a shift ending $label', async ({ startTime, endTime }) => {
      const { onChanged } = renderEditor()
      setTimes('New shift', { startTime, endTime })

      await clickIn('Add a shift', 'Add shift')

      expect(await screen.findByText(END_BEFORE_START_MESSAGE)).toBeInTheDocument()
      expect(apiMock.createSchedule).not.toHaveBeenCalled()
      expect(onChanged).not.toHaveBeenCalled()
    })

    it('shows the server error and does not report a change when adding fails', async () => {
      givenCreateFails(SERVER_ERROR_MESSAGE)
      const { onChanged } = renderEditor()

      await clickIn('Add a shift', 'Add shift')

      expect(await screen.findByText(SERVER_ERROR_MESSAGE)).toBeInTheDocument()
      expect(onChanged).not.toHaveBeenCalled()
    })

    it('ignores a second click while the add is on its way', async () => {
      const create = createDeferred()
      apiMock.createSchedule.mockReturnValue(create.promise)
      renderEditor()

      await clickIn('Add a shift', 'Add shift')
      await clickIn('Add a shift', 'Add shift')

      expect(apiMock.createSchedule).toHaveBeenCalledTimes(1)

      await act(async () => {
        create.resolve({ id: 'new-shift' })
      })
    })
  })

  describe('closing', () => {
    it('closes from the × button without reporting a change', async () => {
      const { onChanged, onClose } = renderEditor({ shifts: [EARLY_SHIFT] })

      await userEvent.click(screen.getByRole('button', { name: 'Close' }))

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onChanged).not.toHaveBeenCalled()
    })

    it('closes when Escape is pressed', async () => {
      const { onClose } = renderEditor({ shifts: [EARLY_SHIFT] })

      await userEvent.keyboard('{Escape}')

      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })
})
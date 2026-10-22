import { useState } from 'react'
import { api } from '../../api'
import { Modal } from '../../components/Modal'
import { formatDayLabel } from './scheduleDates'
import './ShiftEditor.css'

const DEFAULT_START_TIME = '06:00'
const DEFAULT_END_TIME = '14:00'
const END_BEFORE_START_MESSAGE = 'End time must be after start time'

// The API sends '04:00:00', but time inputs and the API's own input format use 'HH:MM'
function toInputTime(timeString) {
  return timeString.slice(0, 5)
}

function useShiftAction(onChanged) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(action) {
    setError('')
    setBusy(true)
    try {
      await action()
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, setError, run }
}

function TimeRange({ label, startTime, endTime, onStartChange, onEndChange }) {
  return (
    <div className="time-range">
      <input
        type="time"
        aria-label={ `${label} start time` }
        value={ startTime }
        onChange={ (event) => onStartChange(event.target.value) }
      />
      <span>–</span>
      <input
        type="time"
        aria-label={ `${label} end time` }
        value={ endTime }
        onChange={ (event) => onEndChange(event.target.value) }
      />
    </div>
  )
}

function ExistingShift({ shift, label, date, onChanged }) {
  const [startTime, setStartTime] = useState(toInputTime(shift.start_time))
  const [endTime, setEndTime] = useState(toInputTime(shift.end_time))
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const { busy, error, setError, run } = useShiftAction(onChanged)

  function handleSave() {
    if (endTime <= startTime) {
      setError(END_BEFORE_START_MESSAGE)
      return
    }
    run(() =>
      api.updateSchedule(shift.id, { shift_date: date, start_time: startTime, end_time: endTime })
    )
  }

  function handleDelete() {
    run(() => api.deleteSchedules([shift.id]))
  }

  return (
    <div className="editor-section">
      <p className="editor-section-title">{ label }</p>
      <TimeRange
        label={ label }
        startTime={ startTime }
        endTime={ endTime }
        onStartChange={ setStartTime }
        onEndChange={ setEndTime }
      />
      <div className="editor-actions">
        { confirmingDelete ? (
          <>
            <button className="danger" onClick={ handleDelete } disabled={ busy }>
              Confirm delete
            </button>
            <button onClick={ () => setConfirmingDelete(false) } disabled={ busy }>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="primary" onClick={ handleSave } disabled={ busy }>
              Save
            </button>
            <button className="danger" onClick={ () => setConfirmingDelete(true) } disabled={ busy }>
              Delete
            </button>
          </>
        )}
      </div>
      { error && <p className="editor-error">{ error }</p> }
    </div>
  )
}

function AddShift({ employee, date, onChanged }) {
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME)
  const [endTime, setEndTime] = useState(DEFAULT_END_TIME)
  const { busy, error, setError, run } = useShiftAction(onChanged)

  function handleAdd() {
    if (endTime <= startTime) {
      setError(END_BEFORE_START_MESSAGE)
      return
    }
    run(() =>
      api.createSchedule({
        user_id: employee.id,
        shift_date: date,
        start_time: startTime,
        end_time: endTime,
      })
    )
  }

  return (
    <div className="editor-section">
      <p className="editor-section-title">Add a shift</p>
      <TimeRange
        label="New shift"
        startTime={ startTime }
        endTime={ endTime }
        onStartChange={ setStartTime }
        onEndChange={ setEndTime }
      />
      <div className="editor-actions">
        <button className="primary" onClick={ handleAdd } disabled={ busy }>
          Add shift
        </button>
      </div>
      { error && <p className="editor-error">{ error }</p> }
    </div>
  )
}

export function ShiftEditor({ employee, date, shifts, onChanged, onClose }) {
  const { weekday, monthDay } = formatDayLabel(date)

  return (
    <Modal title={ employee.full_name } subtitle={ `${weekday} ${monthDay}` } onClose={ onClose }>
      { shifts.length === 0 && <p className="editor-empty">No shifts this day.</p> }
      {shifts.map((shift, index) => (
        <ExistingShift
          key={ shift.id }
          shift={ shift }
          label={ `Shift ${index + 1}` }
          date={ date }
          onChanged={ onChanged }
        />
      ))}

      <AddShift employee={ employee } date={ date } onChanged={ onChanged } />
    </Modal>
  )
}
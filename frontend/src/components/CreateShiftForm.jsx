import { useEffect, useState } from 'react'
import { api } from '../api'
import './CreateShiftForm.css'

const DAYS_OF_WEEK = [
  { value: 'sunday', label: 'Sun' },
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
]

export function CreateShiftForm({ onCreated }) {
  const [mode, setMode] = useState('single')
  const [users, setUsers] = useState([])
  const [userId, setUserId] = useState('')
  const [shiftDate, setShiftDate] = useState('')
  const [startTime, setStartTime] = useState('06:00')
  const [endTime, setEndTime] = useState('14:00')
  const [weeks, setWeeks] = useState(2)
  const [selectedDays, setSelectedDays] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [summary, setSummary] = useState('')

  useEffect(() => {
    api
      .getUsers()
      .then(setUsers)
      .catch((err) => setError(err.message))
  }, [])

  function toggleDay(day) {
    setSelectedDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day]
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSummary('')

    if (endTime <= startTime) {
      setError('End time must be after start time')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'single') {
        await api.createSchedule({
          user_id: userId,
          shift_date: shiftDate,
          start_time: startTime,
          end_time: endTime,
        })
        setShiftDate('')
      } else {
        if (selectedDays.length === 0) {
          setError('Select at least one day of the week')
          setSubmitting(false)
          return
        }
        const result = await api.repeatSchedule({
          user_id: userId,
          start_date: shiftDate,
          weeks,
          days: selectedDays,
          start_time: startTime,
          end_time: endTime,
        })
        const createdCount = result.created?.length || 0
        const skippedCount = result.skipped?.length || 0
        setSummary(`Added ${createdCount} shift(s)${skippedCount ? `, skipped ${skippedCount} (already scheduled)` : ''}.`)
      }
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={ handleSubmit } className="create-shift-form">
      <p className="form-title">Add a shift</p>

      <div className="mode-toggle">
        <button
          type="button"
          className={ mode === 'single' ? 'active' : '' }
          onClick={ () => setMode('single') }
        >
          One-off
        </button>
        <button
          type="button"
          className={ mode === 'repeat' ? 'active' : '' }
          onClick={ () => setMode('repeat') }
        >
          Repeat weekly
        </button>
      </div>

      <label>
        Employee
        <select value={ userId } onChange={ (event) => setUserId(event.target.value) } required>
          <option value="" disabled>Select an employee</option>
          {users.map((user) => (
            <option key={ user.id } value={ user.id }>{ user.full_name }</option>
          ))}
        </select>
      </label>

      <label>
        { mode === 'single' ? 'Date' : 'Starting date' }
        <input
          type="date"
          value={ shiftDate }
          onChange={ (event) => setShiftDate(event.target.value) }
          required
        />
      </label>

      { mode === 'repeat' && (
        <>
          <label>
            Repeat for how many weeks
            <input
              type="number"
              min="1"
              max="26"
              value={ weeks }
              onChange={ (event) => setWeeks(Number(event.target.value)) }
              required
            />
          </label>

          <div className="day-picker">
            {DAYS_OF_WEEK.map((day) => (
              <button
                type="button"
                key={ day.value }
                className={ selectedDays.includes(day.value) ? 'active' : '' }
                onClick={ () => toggleDay(day.value) }
              >
                { day.label }
              </button>
            ))}
          </div>
        </>
      )}

      <div className="time-row">
        <label>
          Start
          <input
            type="time"
            value={ startTime }
            onChange={ (event) => setStartTime(event.target.value) }
            required
          />
        </label>
        <label>
          End
          <input
            type="time"
            value={ endTime }
            onChange={ (event) => setEndTime(event.target.value) }
            required
          />
        </label>
      </div>

      { error && <p className="error">{ error }</p> }
      { summary && <p className="summary">{ summary }</p> }

      <button type="submit" disabled={ submitting }>
        { submitting ? 'Adding...' : mode === 'single' ? 'Add shift' : 'Add shifts' }
      </button>
    </form>
  )
}
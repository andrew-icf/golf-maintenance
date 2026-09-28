import { useEffect, useState } from 'react'
import { api } from '../api'
import './CreateShiftForm.css'

export function CreateShiftForm({ onCreated }) {
  const [users, setUsers] = useState([])
  const [userId, setUserId] = useState('')
  const [shiftDate, setShiftDate] = useState('')
  const [startTime, setStartTime] = useState('06:00')
  const [endTime, setEndTime] = useState('14:00')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api
      .getUsers()
      .then(setUsers)
      .catch((err) => setError(err.message))
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (endTime <= startTime) {
      setError('End time must be after start time')
      return
    }

    setSubmitting(true)
    try {
      await api.createSchedule({
        user_id: userId,
        shift_date: shiftDate,
        start_time: startTime,
        end_time: endTime,
      })
      setShiftDate('')
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
        Date
        <input
          type="date"
          value={ shiftDate }
          onChange={ (event) => setShiftDate(event.target.value) }
          required
        />
      </label>

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

      <button type="submit" disabled={ submitting }>
        { submitting ? 'Adding...' : 'Add shift' }
      </button>
    </form>
  )
}
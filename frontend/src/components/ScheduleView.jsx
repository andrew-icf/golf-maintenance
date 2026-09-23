import { useEffect, useState } from 'react'
import { api } from '../api'
import './ScheduleView.css'

function formatDate(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`)
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(timeStr) {
  const [hours, minutes] = timeStr.split(':')
  const date = new Date()
  date.setHours(Number(hours), Number(minutes))
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function ScheduleView() {
  const [schedules, setSchedules] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getSchedules()
      .then(setSchedules)
      .catch((err) => setError(err.message))
  }, [])

  if (error) {
    return <p className="error">{ error }</p>
  }

  if (!schedules) {
    return <p className="status">Loading schedule...</p>
  }

  const byDate = schedules.reduce((groups, shift) => {
    const key = shift.shift_date
    if (!groups[key]) groups[key] = []
    groups[key].push(shift)
    return groups
  }, {})

  const dates = Object.keys(byDate).sort()

  return (
    <div className="schedule-view">
      <h2>Schedule</h2>
      {dates.map((date) => (
        <section key={ date }>
          <h3>{ formatDate(date) }</h3>
          <ul className="shift-list">
            {byDate[date].map((shift) => (
              <li key={ shift.id } className="shift-row">
                <span className="shift-name">{ shift.full_name }</span>
                <span className="shift-time">
                  { formatTime(shift.start_time) } – { formatTime(shift.end_time) }
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
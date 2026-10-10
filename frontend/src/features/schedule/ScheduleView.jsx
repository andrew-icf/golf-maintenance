import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../auth/AuthContext'
import './ScheduleView.css'
import { CreateShiftForm } from './CreateShiftForm'
import { WeekGrid } from './WeekGrid'
import { buildWeekGrid } from './buildWeekGrid'
import {
  addWeeks,
  formatWeekRange,
  getWeekDates,
  getWeekStart,
  todayDateString,
} from './scheduleDates'

export function ScheduleView() {
  const { user } = useAuth()
  const [weekStart, setWeekStart] = useState(() => getWeekStart(todayDateString()))
  const [roster, setRoster] = useState(null)
  const [loadedWeek, setLoadedWeek] = useState(null)
  const [refreshCount, setRefreshCount] = useState(0)
  const [rosterError, setRosterError] = useState('')
  const [shiftsError, setShiftsError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const todayDate = todayDateString()
  const thisWeekStart = getWeekStart(todayDate)
  const weekDates = getWeekDates(weekStart)

  useEffect(() => {
    api
      .getRoster()
      .then(setRoster)
      .catch((err) => setRosterError(err.message))
  }, [])

  useEffect(() => {
    // If the admin clicks through weeks quickly, a slow response for an old week
    // must not overwrite the week now on screen.
    let isCurrent = true
    const weekEnd = getWeekDates(weekStart).at(-1)

    api
      .getSchedules(weekStart, weekEnd)
      .then((shifts) => {
        if (isCurrent) {
          setLoadedWeek({ weekStart, shifts })
          setShiftsError('')
        }
      })
      .catch((err) => {
        if (isCurrent) {
          setShiftsError(err.message)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [weekStart, refreshCount])

  function goToWeek(newWeekStart) {
    setShiftsError('')
    setWeekStart(newWeekStart)
  }

  function handleCreated() {
    setRefreshCount((current) => current + 1)
  }

  if (rosterError) {
    return <p className="error">{ rosterError }</p>
  }

  if (!roster) {
    return <p className="status">Loading schedule...</p>
  }

  const isWeekLoaded = loadedWeek?.weekStart === weekStart

  return (
    <div className="schedule-view">
      <h2>Schedule</h2>

      { user.role === 'admin' && (
        <div className="admin-actions">
          <button
            className="toggle-form-button"
            onClick={ () => setShowForm((current) => !current) }
            aria-expanded={ showForm }
          >
            { showForm ? 'Close' : '+ Add shift' }
          </button>
          { showForm && <CreateShiftForm onCreated={ handleCreated } /> }
        </div>
      )}

      <div className="week-nav">
        <button aria-label="Previous week" onClick={ () => goToWeek(addWeeks(weekStart, -1)) }>
          ‹
        </button>
        <div className="week-nav-center">
          <span className="week-nav-label">{ formatWeekRange(weekStart) }</span>
          <button
            className="this-week-button"
            onClick={ () => goToWeek(thisWeekStart) }
            disabled={ weekStart === thisWeekStart }
          >
            This week
          </button>
        </div>
        <button aria-label="Next week" onClick={ () => goToWeek(addWeeks(weekStart, 1)) }>
          ›
        </button>
      </div>

      { shiftsError && <p className="error">{ shiftsError }</p> }
      { !isWeekLoaded && !shiftsError && <p className="status">Loading week...</p> }
      { isWeekLoaded && (
        <WeekGrid
          rows={ buildWeekGrid({
            roster,
            shifts: loadedWeek.shifts,
            weekDates,
            currentUserId: user.id,
          }) }
          weekDates={ weekDates }
          todayDate={ todayDate }
        />
      )}
    </div>
  )
}
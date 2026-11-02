import { useEffect, useState } from 'react'
import { api } from '../../api'
import { Modal } from '../../components/Modal'
import { formatJobTitle } from '../../constants/jobTitles'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { ChangePasswordForm } from '../auth/ChangePasswordForm'
import { formatShortDate, getWeekDates, getWeekStart } from '../schedule/scheduleDates'
import { buildShiftDays, todaysShifts } from './myShifts'
import './ClockGate.css'

function describeToday(days) {
  const shifts = todaysShifts(days)

  return shifts.length === 0 ? 'No shift scheduled today.' : shifts.map((shift) => shift.text).join(', ')
}

// The screen a staff member meets until they clock in. It cannot be dismissed. It shows
// today's shift and the week from the person's own schedule, and a failure to load the
// schedule never keeps anyone from clocking in. A person can also change their password here,
// since they might not get past this screen without it.
// onClockIn, onChangePassword, and onLogout do the work and throw when they fail, so the
// screen can say why. onChangePassword is given the current and the new password.
export function ClockGate({ user, todayDate, onClockIn, onChangePassword, onLogout }) {
  const weekStart = getWeekStart(todayDate)
  const weekDates = getWeekDates(weekStart)
  const weekEnd = weekDates[weekDates.length - 1]

  const [shifts, setShifts] = useState(null)
  const [scheduleFailed, setScheduleFailed] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const clockIn = useAsyncAction(onClockIn, 'Could not clock in. Try again.')
  const logout = useAsyncAction(onLogout, 'Could not log out. Try again.')

  useEffect(() => {
    let isCurrent = true

    api
      .getMySchedule(weekStart, weekEnd)
      .then((myShifts) => {
        if (isCurrent) {
          setShifts(myShifts)
          setScheduleFailed(false)
        }
      })
      .catch(() => {
        if (isCurrent) {
          setScheduleFailed(true)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [weekStart, weekEnd])

  const days = shifts ? buildShiftDays(shifts, weekStart, weekDates.length, todayDate) : []
  const isLoading = shifts === null && !scheduleFailed
  const jobTitleLabel = formatJobTitle(user.job_title)

  return (
    <Modal title={ `Welcome, ${user.full_name}` } subtitle={ jobTitleLabel || undefined } dismissible={ false }>
      <div className="clock-gate">
        { isLoading && <p className="clock-gate-note">Loading your schedule...</p> }
        { scheduleFailed && <p className="clock-gate-note">Your schedule could not be loaded.</p> }

        { days.length > 0 && (
          <>
            <section className="clock-gate-today">
              <p className="clock-gate-today-date">{ `Today · ${formatShortDate(todayDate)}` }</p>
              <p className="clock-gate-today-line">{ describeToday(days) }</p>
            </section>

            <section>
              <h2 className="clock-gate-section-title">This week</h2>
              <ul className="clock-gate-week">
                {days.map((day) => (
                  <li
                    key={ day.date }
                    className={ day.isToday ? 'clock-gate-day is-today' : 'clock-gate-day' }
                    aria-current={ day.isToday ? 'date' : undefined }
                  >
                    <span className="clock-gate-day-label">{ `${day.weekday} ${day.monthDay}` }</span>
                    <span className="clock-gate-day-shifts">
                      { day.shifts.length === 0 ? (
                        <span>Off</span>
                      ) : (
                        day.shifts.map((shift) => <span key={ shift.id }>{ shift.text }</span>)
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        <div className="clock-gate-actions">
          <button
            type="button"
            className="clock-gate-clock-in"
            onClick={ clockIn.run }
            disabled={ clockIn.isRunning }
          >
            { clockIn.isRunning ? 'Clocking in...' : 'Clock in' }
          </button>
          { clockIn.error && <p role="alert" className="clock-gate-error">{ clockIn.error }</p> }

          <button type="button" className="clock-gate-link" onClick={ () => setIsChangingPassword(true) }>
            Change password
          </button>

          <button
            type="button"
            className="clock-gate-logout"
            onClick={ logout.run }
            disabled={ logout.isRunning }
          >
            { logout.isRunning ? 'Logging out...' : 'Log out' }
          </button>
          { logout.error && <p role="alert" className="clock-gate-error">{ logout.error }</p> }
        </div>
      </div>

      { isChangingPassword && (
        <ChangePasswordForm onSubmit={ onChangePassword } onClose={ () => setIsChangingPassword(false) } />
      )}
    </Modal>
  )
}
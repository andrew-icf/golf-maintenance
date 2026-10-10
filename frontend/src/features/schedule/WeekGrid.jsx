import { formatJobTitle } from '../../constants/jobTitles'
import { formatDayLabel, formatShiftRange } from './scheduleDates'
import './WeekGrid.css'

export function WeekGrid({ rows, weekDates, todayDate }) {
  if (rows.length === 0) {
    return <p className="status">No staff to schedule yet.</p>
  }

  return (
    <div className="week-grid-scroll">
      <table className="week-grid">
        <thead>
          <tr>
            <th scope="col" className="employee-column">Employee</th>
            {weekDates.map((date) => {
              const { weekday, monthDay } = formatDayLabel(date)
              return (
                <th key={ date } scope="col" className={ date === todayDate ? 'today' : '' }>
                  <span className="day-weekday">{ weekday }</span>
                  <span className="day-date">{ monthDay }</span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const jobTitleLabel = formatJobTitle(row.employee.job_title)
            return (
              <tr key={ row.employee.id } className={ row.isCurrentUser ? 'current-user' : '' }>
                <th scope="row" className="employee-column">
                  <span className="employee-name">{ row.employee.full_name }</span>
                  { jobTitleLabel && <span className="employee-title">{ jobTitleLabel }</span> }
                </th>
                {row.cells.map((cell) => (
                  <td key={ cell.date } className={ cell.date === todayDate ? 'today' : '' }>
                    {cell.shifts.length === 0 ? (
                      <span className="off">—</span>
                    ) : (
                      cell.shifts.map((shift) => (
                        <span key={ shift.id } className="shift">
                          { formatShiftRange(shift.start_time, shift.end_time) }
                        </span>
                      ))
                    )}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
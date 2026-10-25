import { formatJobTitle } from '../../constants/jobTitles'
import { formatDayLabel, formatShiftRange } from './scheduleDates'
import './WeekGrid.css'

function describeShifts(shifts) {
  if (shifts.length === 0) {
    return 'day off'
  }
  return shifts.map((shift) => formatShiftRange(shift.start_time, shift.end_time)).join(', ')
}

function CellContent({ shifts }) {
  if (shifts.length === 0) {
    return <span className="off">—</span>
  }

  return (
    <>
      {shifts.map((shift) => (
        <span key={ shift.id } className="shift">
          { formatShiftRange(shift.start_time, shift.end_time) }
        </span>
      ))}
    </>
  )
}

export function WeekGrid({ rows, weekDates, todayDate, onCellClick }) {
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
                {row.cells.map((cell) => {
                  const { weekday, monthDay } = formatDayLabel(cell.date)
                  const classNames = [
                    cell.date === todayDate ? 'today' : '',
                    onCellClick ? 'editable' : '',
                  ].filter(Boolean).join(' ')

                  return (
                    <td key={ cell.date } className={ classNames }>
                      {onCellClick ? (
                        <button
                          type="button"
                          className="cell-button"
                          aria-label={ `Edit ${row.employee.full_name}, ${weekday} ${monthDay}: ${describeShifts(cell.shifts)}` }
                          onClick={ () => onCellClick(row.employee, cell.date, cell.shifts) }
                        >
                          <CellContent shifts={ cell.shifts } />
                        </button>
                      ) : (
                        <CellContent shifts={ cell.shifts } />
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
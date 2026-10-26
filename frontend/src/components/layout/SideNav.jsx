import { NavLink } from 'react-router-dom'
import { formatHoleCount, formatYardage } from '../../features/course/courseSummary'
import { formatShortDate } from '../../features/schedule/scheduleDates'
import { NavIcon } from './NavIcon'
import { NAV_ITEMS } from './navItems'
import './SideNav.css'

// `course` is the output of summarizeCourse, or null until the course details are available
export function SideNav({ course, todayDate }) {
  return (
    <aside className="side-nav">
      <div className="side-nav-header">
        <p className="side-nav-app-name">Golf Maintenance</p>

        { course && (
          <>
            <div className="side-nav-course">
              <div className="side-nav-course-mark">
                <NavIcon name="course" size={ 24 } />
              </div>
              <div className="side-nav-course-text">
                <p className="side-nav-course-name">{ course.name }</p>
                <p className="side-nav-course-holes">{ formatHoleCount(course.holeCount) }</p>
              </div>
            </div>

            <dl className="side-nav-facts">
              <div>
                <dt>Total yardage</dt>
                <dd>{ formatYardage(course.totalYardage) }</dd>
              </div>
              <div>
                <dt>Today</dt>
                <dd>{ formatShortDate(todayDate) }</dd>
              </div>
            </dl>
          </>
        )}
      </div>

      <nav aria-label="Main">
        <ul className="side-nav-list">
          {NAV_ITEMS.map((item) => (
            <li key={ item.path }>
              <NavLink
                to={ item.path }
                className={ ({ isActive }) => (isActive ? 'side-nav-link active' : 'side-nav-link') }
              >
                <NavIcon name={ item.icon } />
                <span>{ item.label }</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
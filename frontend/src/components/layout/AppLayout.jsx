import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../features/auth/AuthContext'
import { ClockControl } from '../../features/clock/ClockControl'
import { ClockGate } from '../../features/clock/ClockGate'
import { isGated, logsOutOnClockOut } from '../../features/clock/clockStatus'
import { summarizeCourse } from '../../features/course/courseSummary'
import { todayDateString } from '../../features/schedule/scheduleDates'
import { SideNav } from './SideNav'
import { TopBar } from './TopBar'
import { findNavItem } from './navItems'
import './AppLayout.css'

export function AppLayout() {
  const { user, logout, refreshUser } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [course, setCourse] = useState(null)
  const behindTheGate = isGated(user)

  // The course details are work information, so they load only once the person may work
  useEffect(() => {
    if (behindTheGate) {
      return undefined
    }

    let isCurrent = true

    api
      .getCourse()
      .then((courseDetails) => {
        if (isCurrent) {
          setCourse(summarizeCourse(courseDetails))
        }
      })
      .catch(() => {
        // The sidebar header is a nicety, so a failed load just leaves it showing the app name
      })

    return () => {
      isCurrent = false
    }
  }, [behindTheGate])

  async function handleClockIn() {
    await api.clockIn()
    await refreshUser()
  }

  // Staff are logged out as well as clocked out, so the next person to pick up a shared tablet
  // doesn't find them signed in. Admins stay logged in.
  async function handleClockOut() {
    await api.clockOut()

    if (!logsOutOnClockOut(user)) {
      await refreshUser()
      return
    }

    try {
      await logout()
    } catch {
      // Clocking out worked, so show the clock-in screen even though logging out did not
      await refreshUser()
      return
    }
    navigate('/login')
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const navItem = findNavItem(pathname)
  const pageWidth = navItem?.width ?? 'reading'

  return (
    <div className="app-layout">
      <SideNav course={ course } todayDate={ todayDateString() } />
      <div className="app-layout-main">
        <TopBar
          title={ navItem?.title ?? '' }
          user={ user }
          onLogout={ handleLogout }
          clockControl={
            behindTheGate ? null : (
              <ClockControl user={ user } onClockIn={ handleClockIn } onClockOut={ handleClockOut } />
            )
          }
        />
        <main className="app-layout-content">
          <div className={ `app-layout-page app-layout-page-${pageWidth}` }>
            { !behindTheGate && <Outlet /> }
          </div>
        </main>
      </div>
      { behindTheGate && (
        <ClockGate
          user={ user }
          todayDate={ todayDateString() }
          onClockIn={ handleClockIn }
          onLogout={ handleLogout }
        />
      )}
    </div>
  )
}
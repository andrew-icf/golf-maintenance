import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../features/auth/AuthContext'
import { summarizeCourse } from '../../features/course/courseSummary'
import { todayDateString } from '../../features/schedule/scheduleDates'
import { SideNav } from './SideNav'
import { TopBar } from './TopBar'
import { findNavItem } from './navItems'
import './AppLayout.css'

export function AppLayout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [course, setCourse] = useState(null)

  useEffect(() => {
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
  }, [])

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
        <TopBar title={ navItem?.title ?? '' } user={ user } onLogout={ handleLogout } />
        <main className="app-layout-content">
          <div className={ `app-layout-page app-layout-page-${pageWidth}` }>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
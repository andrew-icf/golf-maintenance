import { NavLink } from 'react-router-dom'
import './NavBar.css'

export function NavBar() {
  return (
    <nav className="nav-bar">
      <NavLink to="/clock" className={({ isActive }) => (isActive ? 'active' : '')}>
        Clock
      </NavLink>
      <NavLink to="/course" className={({ isActive }) => (isActive ? 'active' : '')}>
        Course
      </NavLink>
      <NavLink to="/equipment" className={({ isActive }) => (isActive ? 'active' : '')}>
        Equipment
      </NavLink>
      <NavLink to="/schedule" className={({ isActive }) => (isActive ? 'active' : '')}>
        Schedule
      </NavLink>
    </nav>
  )
}
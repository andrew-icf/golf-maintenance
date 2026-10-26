import { useState } from 'react'
import { formatJobTitle } from '../../constants/jobTitles'
import './TopBar.css'

export function TopBar({ title, user, onLogout }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const jobTitleLabel = formatJobTitle(user.job_title)

  async function handleLogout() {
    setLogoutError('')
    setIsLoggingOut(true)
    try {
      await onLogout()
    } catch {
      setLogoutError('Could not log out. Try again.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="top-bar">
      <h1 className="top-bar-title">{ title }</h1>

      <div className="top-bar-user">
        <div className="top-bar-user-text">
          <p className="top-bar-user-name">{ user.full_name }</p>
          { jobTitleLabel && <p className="top-bar-user-title">{ jobTitleLabel }</p> }
        </div>
        <button className="top-bar-logout" onClick={ handleLogout } disabled={ isLoggingOut }>
          { isLoggingOut ? 'Logging out...' : 'Log out' }
        </button>
      </div>

      { logoutError && <p role="alert" className="top-bar-error">{ logoutError }</p> }
    </header>
  )
}
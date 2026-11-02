import { useState } from 'react'
import { formatJobTitle } from '../../constants/jobTitles'
import { ChangePasswordForm } from '../../features/auth/ChangePasswordForm'
import './TopBar.css'

// `clockControl` is whatever clock control the layout wants beside the person's name, or
// nothing. The top bar only holds it, so it needs no idea how the clock works.
// onChangePassword is given the current and the new password and throws when it fails. When
// it isn't given, there is no Change password button.
export function TopBar({ title, user, onLogout, onChangePassword, clockControl = null }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
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
        { clockControl }
        <div className="top-bar-user-text">
          <p className="top-bar-user-name">{ user.full_name }</p>
          { jobTitleLabel && <p className="top-bar-user-title">{ jobTitleLabel }</p> }
        </div>
        { onChangePassword && (
          <button type="button" className="top-bar-logout" onClick={ () => setIsChangingPassword(true) }>
            Change password
          </button>
        )}
        <button className="top-bar-logout" onClick={ handleLogout } disabled={ isLoggingOut }>
          { isLoggingOut ? 'Logging out...' : 'Log out' }
        </button>
      </div>

      { logoutError && <p role="alert" className="top-bar-error">{ logoutError }</p> }

      { isChangingPassword && (
        <ChangePasswordForm onSubmit={ onChangePassword } onClose={ () => setIsChangingPassword(false) } />
      )}
    </header>
  )
}
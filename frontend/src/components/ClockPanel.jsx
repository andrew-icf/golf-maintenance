import { useState } from 'react'
import { useAuth } from '../AuthContext'
import { api } from '../api'
import './ClockPanel.css'

export function ClockPanel() {
  const { user, logout, refreshUser } = useAuth()
  const [status, setStatus] = useState('')

  async function handleClockIn() {
    try {
      await api.clockIn()
      setStatus('Clocked in!')
      await refreshUser()
    } catch (err) {
      setStatus(err.message)
    }
  }

  async function handleClockOut() {
    try {
      await api.clockOut()
      setStatus('Clocked out!')
      await refreshUser()
    } catch (err) {
      setStatus(err.message)
    }
  }

  return (
    <div className="clock-panel">
      <p>Welcome, {user.full_name}</p>
      <div className="clock-buttons">
        {user.clocked_in ? (
          <button onClick={handleClockOut}>Clock Out</button>
        ) : (
          <button onClick={handleClockIn}>Clock In</button>
        )}
      </div>
      {status && <p className="status">{status}</p>}
      <button onClick={logout} className="logout-link">
        Log out
      </button>
    </div>
  )
}
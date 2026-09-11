import { useState } from 'react'
import { useAuth } from '../AuthContext'
import './LoginForm.css'

export function LoginForm() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setError('Invalid email or password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(err) => setEmail(err.target.value)}
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(err) => setPassword(err.target.value)}
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Logging in...' : 'Log in'}
      </button>
    </form>
  )
}
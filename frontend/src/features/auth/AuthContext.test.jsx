import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from './AuthContext'

const { apiMock } = vi.hoisted(() => ({
  apiMock: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
}))

vi.mock('../../api', () => ({ api: apiMock }))

// Test data
const PROFILE_ON_THE_CLOCK = {
  id: 'user-1',
  full_name: 'Alex Rivera',
  job_title: 'master_mechanic',
  clocked_in: true,
}
// The real login response has no clocked_in or job_title, only /me does
const LOGIN_RESPONSE = {
  id: 'user-1',
  full_name: 'Alex Rivera',
  role: 'admin',
  message: 'login successful',
}
const NOT_AUTHENTICATED = new Error('not authenticated')
const WRONG_PASSWORD = new Error('invalid email or password')

const LOADING_TEXT = 'Checking session...'
const SIGNED_OUT_TEXT = 'Signed out'
const SIGNED_IN_TEXT = 'Signed in as Alex Rivera'
const ON_THE_CLOCK_TEXT = 'On the clock'
const JOB_TITLE_TEXT = 'Title: master_mechanic'

// A minimal consumer that prints what the context holds
function AuthProbe() {
  const { user, loading, login, logout } = useAuth()

  if (loading) return <p>{ LOADING_TEXT }</p>

  return (
    <div>
      <p>{ user ? `Signed in as ${user.full_name}` : SIGNED_OUT_TEXT }</p>
      { user && <p>{ user.clocked_in ? ON_THE_CLOCK_TEXT : 'Off the clock' }</p> }
      { user && <p>{ `Title: ${user.job_title}` }</p> }
      <button onClick={ () => login('alex@example.com', 'password123').catch(() => {}) }>
        Log in
      </button>
      <button onClick={ logout }>Log out</button>
    </div>
  )
}

// Scenarios
function givenNoActiveSession() {
  apiMock.me.mockRejectedValue(NOT_AUTHENTICATED)
}

function givenAnActiveSession() {
  apiMock.me.mockResolvedValue(PROFILE_ON_THE_CLOCK)
}

// First check finds nobody signed in, then the session exists once login has happened
function givenSessionStartsAfterLogin() {
  apiMock.me.mockRejectedValueOnce(NOT_AUTHENTICATED).mockResolvedValue(PROFILE_ON_THE_CLOCK)
  apiMock.login.mockResolvedValue(LOGIN_RESPONSE)
}

function givenLoginIsRejected() {
  apiMock.me.mockRejectedValue(NOT_AUTHENTICATED)
  apiMock.login.mockRejectedValue(WRONG_PASSWORD)
}

// Actions
function renderProvider() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>
  )
}

async function clickButton(name) {
  await userEvent.click(screen.getByRole('button', { name }))
}

describe('AuthProvider', () => {
  beforeEach(() => {
    apiMock.me.mockReset()
    apiMock.login.mockReset()
    apiMock.logout.mockReset()
  })

  it('waits for the session check before deciding anyone is signed out', async () => {
    givenNoActiveSession()

    renderProvider()

    expect(screen.getByText(LOADING_TEXT)).toBeInTheDocument()
    expect(await screen.findByText(SIGNED_OUT_TEXT)).toBeInTheDocument()
  })

  it('restores an existing session when the app loads', async () => {
    givenAnActiveSession()

    renderProvider()

    expect(await screen.findByText(SIGNED_IN_TEXT)).toBeInTheDocument()
    expect(screen.getByText(ON_THE_CLOCK_TEXT)).toBeInTheDocument()
  })

  it('loads the full profile from /me after login, including clock status and job title', async () => {
    givenSessionStartsAfterLogin()
    renderProvider()
    await screen.findByText(SIGNED_OUT_TEXT)

    await clickButton('Log in')

    expect(await screen.findByText(SIGNED_IN_TEXT)).toBeInTheDocument()
    expect(screen.getByText(ON_THE_CLOCK_TEXT)).toBeInTheDocument()
    expect(screen.getByText(JOB_TITLE_TEXT)).toBeInTheDocument()
    expect(apiMock.me).toHaveBeenCalledTimes(2)
  })

  it('stays signed out when login is rejected', async () => {
    givenLoginIsRejected()
    renderProvider()
    await screen.findByText(SIGNED_OUT_TEXT)

    await clickButton('Log in')

    expect(apiMock.login).toHaveBeenCalledTimes(1)
    expect(screen.getByText(SIGNED_OUT_TEXT)).toBeInTheDocument()
  })

  it('signs the user out locally after logout', async () => {
    givenAnActiveSession()
    apiMock.logout.mockResolvedValue({ message: 'logged out' })
    renderProvider()
    await screen.findByText(SIGNED_IN_TEXT)

    await clickButton('Log out')

    expect(await screen.findByText(SIGNED_OUT_TEXT)).toBeInTheDocument()
    expect(apiMock.logout).toHaveBeenCalledTimes(1)
  })
})
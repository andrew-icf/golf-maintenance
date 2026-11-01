import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  LOGIN_RESPONSE,
  NOT_AUTHENTICATED,
  OTHER_CHECK_FAILURE_CASES,
  PROFILE_OFF_THE_CLOCK,
  PROFILE_ON_THE_CLOCK,
  WRONG_PASSWORD,
} from '../../test/fixtures/authCases'
import { createDeferred } from '../../test/helpers'
import { AuthProvider, useAuth } from './AuthContext'

const { apiMock, setHandlerMock } = vi.hoisted(() => ({
  apiMock: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
  setHandlerMock: vi.fn(),
}))

// Everything in the real api module stays real (its error class and its checks), except the
// calls to the server and the registering of the clock-in listener, which the tests watch
vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: apiMock,
  setClockInRequiredHandler: setHandlerMock,
}))

const LOADING_TEXT = 'Checking session...'
const SIGNED_OUT_TEXT = 'Signed out'
const SIGNED_IN_TEXT = 'Signed in as Luke Skywalker'
const ON_THE_CLOCK_TEXT = 'On the clock'
const OFF_THE_CLOCK_TEXT = 'Off the clock'
const JOB_TITLE_TEXT = 'Title: operator'

// A minimal consumer that prints what the context holds
function AuthProbe() {
  const { user, loading, login, logout } = useAuth()

  if (loading) return <p>{ LOADING_TEXT }</p>

  return (
    <div>
      <p>{ user ? `Signed in as ${user.full_name}` : SIGNED_OUT_TEXT }</p>
      { user && <p>{ user.clocked_in ? ON_THE_CLOCK_TEXT : OFF_THE_CLOCK_TEXT }</p> }
      { user && <p>{ `Title: ${user.job_title}` }</p> }
      <button onClick={ () => login('luke@example.com', 'password123').catch(() => {}) }>
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

async function renderSignedIn() {
  givenAnActiveSession()
  const view = renderProvider()
  await screen.findByText(SIGNED_IN_TEXT)
  return view
}

async function clickButton(name) {
  await userEvent.click(screen.getByRole('button', { name }))
}

// The listeners the provider has registered with the API client, newest last. Removing one
// registers null, which is not a listener.
function registeredListeners() {
  return setHandlerMock.mock.calls.map(([listener]) => listener).filter(Boolean)
}

function newestListener() {
  const listeners = registeredListeners()
  return listeners[listeners.length - 1]
}

// What the API client does when the server says clock in is required: call the listener
async function serverSaysClockInIsRequired() {
  await act(async () => {
    await newestListener()()
  })
}

describe('AuthProvider', () => {
  beforeEach(() => {
    apiMock.me.mockReset()
    apiMock.login.mockReset()
    apiMock.logout.mockReset()
    setHandlerMock.mockReset()
  })

  it('waits for the session check before deciding anyone is signed out', async () => {
    givenNoActiveSession()

    renderProvider()

    expect(screen.getByText(LOADING_TEXT)).toBeInTheDocument()
    expect(await screen.findByText(SIGNED_OUT_TEXT)).toBeInTheDocument()
  })

  it('restores an existing session when the app loads', async () => {
    await renderSignedIn()

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
    apiMock.logout.mockResolvedValue({ message: 'logged out' })
    await renderSignedIn()

    await clickButton('Log out')

    expect(await screen.findByText(SIGNED_OUT_TEXT)).toBeInTheDocument()
    expect(apiMock.logout).toHaveBeenCalledTimes(1)
  })

  describe('who counts as signed out', () => {
    it('signs the person out when a check says nobody is logged in', async () => {
      await renderSignedIn()
      apiMock.me.mockRejectedValue(NOT_AUTHENTICATED)

      await serverSaysClockInIsRequired()

      expect(screen.getByText(SIGNED_OUT_TEXT)).toBeInTheDocument()
    })

    it.each(OTHER_CHECK_FAILURE_CASES)(
      'keeps the person signed in when a check fails with $label',
      async ({ failure }) => {
        await renderSignedIn()
        apiMock.me.mockRejectedValue(failure)

        await serverSaysClockInIsRequired()

        expect(screen.getByText(SIGNED_IN_TEXT)).toBeInTheDocument()
        expect(screen.getByText(ON_THE_CLOCK_TEXT)).toBeInTheDocument()
      }
    )

    it('shows the signed-out screen, not the loading screen, when the very first check fails for another reason', async () => {
      apiMock.me.mockRejectedValue(new TypeError('Failed to fetch'))

      renderProvider()

      expect(await screen.findByText(SIGNED_OUT_TEXT)).toBeInTheDocument()
      expect(screen.queryByText(LOADING_TEXT)).not.toBeInTheDocument()
    })
  })

  describe('when the server says clock in is required', () => {
    it('registers a listener for it', async () => {
      await renderSignedIn()

      expect(typeof newestListener()).toBe('function')
    })

    it('registers one listener, however often the provider renders again', async () => {
      await renderSignedIn()
      apiMock.me.mockResolvedValueOnce({ ...PROFILE_OFF_THE_CLOCK })

      await serverSaysClockInIsRequired()

      expect(await screen.findByText(OFF_THE_CLOCK_TEXT)).toBeInTheDocument()
      expect(registeredListeners()).toHaveLength(1)
    })

    it('removes the listener when the provider goes away', async () => {
      const { unmount } = await renderSignedIn()

      unmount()

      expect(setHandlerMock).toHaveBeenLastCalledWith(null)
    })

    it('asks who is logged in again, which shows that the person is no longer clocked in', async () => {
      await renderSignedIn()
      expect(screen.getByText(ON_THE_CLOCK_TEXT)).toBeInTheDocument()
      apiMock.me.mockResolvedValue(PROFILE_OFF_THE_CLOCK)

      await serverSaysClockInIsRequired()

      expect(screen.getByText(OFF_THE_CLOCK_TEXT)).toBeInTheDocument()
      expect(screen.getByText(SIGNED_IN_TEXT)).toBeInTheDocument()
    })
  })

  describe('only the newest answer counts', () => {
    it('ignores a slow older answer that arrives after a newer one', async () => {
      await renderSignedIn()
      const olderAnswer = createDeferred()
      apiMock.me
        .mockReturnValueOnce(olderAnswer.promise)
        .mockResolvedValueOnce(PROFILE_OFF_THE_CLOCK)

      let olderCheck
      act(() => {
        olderCheck = newestListener()()
      })
      await serverSaysClockInIsRequired()
      expect(screen.getByText(OFF_THE_CLOCK_TEXT)).toBeInTheDocument()

      await act(async () => {
        olderAnswer.resolve(PROFILE_ON_THE_CLOCK)
        await olderCheck
      })

      expect(screen.getByText(OFF_THE_CLOCK_TEXT)).toBeInTheDocument()
    })

    it('does not bring someone back when a slow check arrives after they log out', async () => {
      apiMock.logout.mockResolvedValue({ message: 'logged out' })
      await renderSignedIn()
      const slowAnswer = createDeferred()
      apiMock.me.mockReturnValueOnce(slowAnswer.promise)

      let slowCheck
      act(() => {
        slowCheck = newestListener()()
      })
      await clickButton('Log out')
      expect(await screen.findByText(SIGNED_OUT_TEXT)).toBeInTheDocument()

      await act(async () => {
        slowAnswer.resolve(PROFILE_ON_THE_CLOCK)
        await slowCheck
      })

      expect(screen.getByText(SIGNED_OUT_TEXT)).toBeInTheDocument()
    })
  })
})
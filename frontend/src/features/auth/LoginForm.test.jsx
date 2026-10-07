import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './LoginForm'

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }))

vi.mock('./AuthContext', () => ({
  useAuth: () => ({ login: loginMock }),
}))

// Test data
const VALID_CREDENTIALS = { email: 'staff@example.com', password: 'password123' }
const WRONG_CREDENTIALS = { email: 'staff@example.com', password: 'wrongpassword' }
const LOGIN_ERROR_MESSAGE = 'Invalid email or password'

// Scenarios: these name what the backend is doing, hiding the mock mechanics
function givenLoginSucceeds() {
  loginMock.mockResolvedValue()
}

function givenLoginFails() {
  loginMock.mockRejectedValue(new Error('unauthorized'))
}

function givenLoginIsPending() {
  let finishLogin
  loginMock.mockReturnValue(
    new Promise((resolve) => {
      finishLogin = resolve
    })
  )
  return finishLogin
}

// Actions
async function submitLoginForm({ email, password }) {
  const user = userEvent.setup()
  render(<LoginForm />)
  await user.type(screen.getByLabelText(/email/i), email)
  await user.type(screen.getByLabelText(/password/i), password)
  await user.click(screen.getByRole('button', { name: /log in/i }))
}

describe('LoginForm', () => {
  beforeEach(() => {
    loginMock.mockReset()
  })

  it('submits the entered email and password', async () => {
    givenLoginSucceeds()

    await submitLoginForm(VALID_CREDENTIALS)

    expect(loginMock).toHaveBeenCalledWith(
      VALID_CREDENTIALS.email,
      VALID_CREDENTIALS.password
    )
  })

  it('shows an error message when login fails', async () => {
    givenLoginFails()

    await submitLoginForm(WRONG_CREDENTIALS)

    expect(await screen.findByText(LOGIN_ERROR_MESSAGE)).toBeInTheDocument()
  })

  it('disables the button while the request is in flight', async () => {
    const finishLogin = givenLoginIsPending()

    await submitLoginForm(VALID_CREDENTIALS)
    expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled()

    finishLogin()
    expect(await screen.findByRole('button', { name: /log in/i })).toBeEnabled()
  })
})
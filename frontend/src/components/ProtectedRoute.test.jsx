import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('../AuthContext', () => ({
  useAuth: useAuthMock,
}))

// Test data
const LOGGED_IN_USER = { id: 'user-1', full_name: 'Alexes Rivers', role: 'staff' }
const PROTECTED_CONTENT = 'Protected content'
const LOGIN_PAGE = 'Login page'
const LOADING_TEXT = 'Loading...'

// Scenarios
function givenAuthIsLoading() {
  useAuthMock.mockReturnValue({ user: null, loading: true })
}

function givenLoggedOut() {
  useAuthMock.mockReturnValue({ user: null, loading: false })
}

function givenLoggedIn() {
  useAuthMock.mockReturnValue({ user: LOGGED_IN_USER, loading: false })
}

// Actions
function visitProtectedPage() {
  render(
    <MemoryRouter initialEntries={['/clock']}>
      <Routes>
        <Route path="/login" element={<p>{ LOGIN_PAGE }</p>} />
        <Route
          path="/clock"
          element={
            <ProtectedRoute>
              <p>{ PROTECTED_CONTENT }</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  it('shows the protected content to a logged-in user', () => {
    givenLoggedIn()

    visitProtectedPage()

    expect(screen.getByText(PROTECTED_CONTENT)).toBeInTheDocument()
    expect(screen.queryByText(LOGIN_PAGE)).not.toBeInTheDocument()
  })

  it('redirects a logged-out user to the login page', () => {
    givenLoggedOut()

    visitProtectedPage()

    expect(screen.getByText(LOGIN_PAGE)).toBeInTheDocument()
    expect(screen.queryByText(PROTECTED_CONTENT)).not.toBeInTheDocument()
  })

  it('waits without redirecting while the session check is still loading', () => {
    givenAuthIsLoading()

    visitProtectedPage()

    expect(screen.getByText(LOADING_TEXT)).toBeInTheDocument()
    expect(screen.queryByText(LOGIN_PAGE)).not.toBeInTheDocument()
    expect(screen.queryByText(PROTECTED_CONTENT)).not.toBeInTheDocument()
  })
})
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api, isUnauthorized, setClockInRequiredHandler } from '../../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // Counts the checks of who is logged in, so only the newest one counts. A slow, older answer
  // must not overwrite a newer one, or bring back someone who has since logged out.
  const latestCheck = useRef(0)

  // Asks the server who is logged in. Only a real "not logged in" answer (401) signs the person
  // out. Any other failure, like a dropped connection, keeps whoever was already signed in.
  const refreshUser = useCallback(async () => {
    latestCheck.current += 1
    const thisCheck = latestCheck.current

    try {
      const data = await api.me()
      if (thisCheck === latestCheck.current) {
        setUser(data)
      }
    } catch (failure) {
      if (isUnauthorized(failure) && thisCheck === latestCheck.current) {
        setUser(null)
      }
    }
  }, [])

  useEffect(() => {
    refreshUser().finally(() => setLoading(false))
  }, [refreshUser])

  // When the server says a request needs the person to be on the clock, find out where they
  // stand. That brings up the clock-in screen if they have clocked out somewhere else.
  useEffect(() => {
    setClockInRequiredHandler(refreshUser)
    return () => setClockInRequiredHandler(null)
  }, [refreshUser])

  async function login(email, password) {
    await api.login(email, password)
    await refreshUser()
  }

  async function logout() {
    await api.logout()
    // Any check still on its way was started before this, so its answer no longer counts
    latestCheck.current += 1
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
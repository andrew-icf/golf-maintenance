import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  async function refreshUser() {
    try {
      const data = await api.me()
      setUser(data)
    } catch {
      setUser(null)
    }
  }

  useEffect(() => {
    refreshUser().finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    const data = await api.login(email, password)
    setUser(data)
  }

  async function logout() {
    await api.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(getToken()))

  function clearSession() {
    setToken(null)
    setUser(null)
  }

  useEffect(() => {
    setUnauthorizedHandler(clearSession)
    if (!getToken()) {
      return
    }
    api.me()
      .then(setUser)
      .catch(clearSession)
      .finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    const data = await api.login(email, password)
    setToken(data.token)
    setUser(data.user)
  }

  async function register(name, email, password) {
    await api.register(name, email, password)
    await login(email, password)
  }

  async function logout() {
    try {
      await api.logout()
    } finally {
      clearSession()
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
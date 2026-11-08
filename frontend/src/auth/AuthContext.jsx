import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler, TOKEN_KEY } from '../api/client'
import { connectSocket, disconnectSocket } from '../realtime/socketClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(getToken()))
  const signedIn = Boolean(user)

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

  useEffect(() => {
    if (signedIn) {
      connectSocket()
    } else {
      disconnectSocket()
    }
  }, [signedIn])

  useEffect(() => {
    if (!signedIn) return
    function checkToken() {
      if (!getToken()) clearSession()
    }
    function onVisible() {
      if (document.visibilityState === 'visible') checkToken()
    }
    function onStorage(e) {
      if (e.key !== null && e.key !== TOKEN_KEY) return
      if (!getToken()) clearSession()
      else window.location.reload()
    }
    window.addEventListener('focus', checkToken)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('focus', checkToken)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('storage', onStorage)
    }
  }, [signedIn])

  async function login(email, password) {
    const data = await api.login(email, password)
    setToken(data.token)
    setUser(data.user)
  }

  async function register(name, email, password) {
    await api.register(name, email, password)
    await login(email, password)
  }

  async function updateProfile(data) {
    setUser(await api.updateMe(data))
  }

  async function changeEmail(email, currentPassword) {
    setUser(await api.changeEmail(email, currentPassword))
  }

  async function deleteAccount(currentPassword) {
    await api.deleteAccount(currentPassword)
    clearSession()
  }

  async function logout() {
    try {
      await api.logout()
    } finally {
      clearSession()
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateProfile, changeEmail, deleteAccount, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
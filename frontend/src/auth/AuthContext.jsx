import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler, TOKEN_KEY } from '../api/client'
import { connectSocket, disconnectSocket, setServerDisconnectHandler } from '../realtime/socketClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(getToken()))
  const [authError, setAuthError] = useState(null)
  const signedIn = Boolean(user)

  function clearSession() {
    setToken(null)
    setUser(null)
  }

  useEffect(() => {
    setUnauthorizedHandler(clearSession)
    // A 401 here signs out through the handler above; a valid session reconnects.
    setServerDisconnectHandler(() => {
      api.me().then(() => connectSocket()).catch(() => {})
    })
    if (!getToken()) {
      return
    }
    api.me()
      .then(setUser)
      .catch((err) => {
        // A 401 already signs out through the unauthorized handler.
        if (err.status !== 401) setAuthError(err)
      })
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
    const timer = setInterval(checkToken, 1000)
    return () => {
      clearInterval(timer)
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

  // The server keeps the old email and returns the account with pending_email
  // set. The email changes only in confirmEmailChange(), with the code that
  // was sent to the new address.
  async function confirmEmailChange(code) {
    setUser(await api.confirmEmailChange(code))
  }

  async function cancelEmailChange() {
    setUser(await api.cancelEmailChange())
  }

  async function verifyEmail(code) {
    setUser(await api.verifyEmail(code))
  }

  async function deleteAccount(currentPassword) {
    await api.deleteAccount(currentPassword)
    clearSession()
  }

  // No finally: if the request fails, the other devices are still signed in,
  // so this one must not look signed out.
  async function logoutAll(currentPassword) {
    const { token } = await api.logoutAll(currentPassword)
    setToken(token)
    disconnectSocket()
    connectSocket()
  }

  // The server ends every session and answers with a new token for this
  // device, the same as logoutAll().
  async function changePassword(currentPassword, newPassword) {
    const { token } = await api.changePassword(currentPassword, newPassword)
    setToken(token)
    disconnectSocket()
    connectSocket()
  }

  // Re-reads the account, for example after an admin changed its role.
  // A 401 here signs out through the unauthorized handler.
  async function refreshUser() {
    try {
      setUser(await api.me())
    } catch {
      return
    }
  }

  async function logout() {
    try {
      await api.logout()
    } finally {
      clearSession()
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, authError, login, register, updateProfile, changeEmail, confirmEmailChange, cancelEmailChange, verifyEmail, deleteAccount, logoutAll, changePassword, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
import { createContext, useContext, useState } from 'react'
import { getToken, setToken } from '../api/client'
import { accountActions, sessionActions } from './authActions'
import { useSessionStart, useSocketWhileSignedIn, useTokenWatch } from './sessionHooks'

const AuthContext = createContext(null)

// The signed-in user for the whole app, and every call that changes it.
// loading is true only while a saved token is being checked.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(getToken()))
  const [authError, setAuthError] = useState(null)
  const signedIn = Boolean(user)

  function clearSession() {
    setToken(null)
    setUser(null)
  }

  useSessionStart({ setUser, setLoading, setAuthError, clearSession })
  useSocketWhileSignedIn(signedIn)
  useTokenWatch(signedIn, clearSession)
  const value = { user, loading, authError, ...sessionActions(setUser, clearSession), ...accountActions(setUser) }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
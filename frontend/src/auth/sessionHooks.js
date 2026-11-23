import { useEffect } from 'react'
import { api, getToken, setUnauthorizedHandler, TOKEN_KEY } from '../api/client'
import { connectSocket, disconnectSocket, setServerDisconnectHandler } from '../realtime/socketClient'

// Loads the account of a saved token once, when the app opens.
export function useSessionStart({ setUser, setLoading, setAuthError, clearSession }) {
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
    // Once only: the setters never change, and clearSession only clears state.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export function useSocketWhileSignedIn(signedIn) {
  useEffect(() => {
    if (signedIn) {
      connectSocket()
    } else {
      disconnectSocket()
    }
  }, [signedIn])
}

// Another tab may sign out (the token is gone) or sign in as someone else
// (the token changed). Checked on focus, when the tab shows again, on every
// storage event and once a second.
export function useTokenWatch(signedIn, clearSession) {
  useEffect(() => {
    if (!signedIn) return
    const { checkToken, onVisible, onStorage } = tokenWatchers(clearSession)
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
    // clearSession only clears state, so an older copy of it does the same.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn])
}

function tokenWatchers(clearSession) {
  function checkToken() {
    if (!getToken()) clearSession()
  }
  return {
    checkToken,
    onVisible() {
      if (document.visibilityState === 'visible') checkToken()
    },
    onStorage(e) {
      if (e.key !== null && e.key !== TOKEN_KEY) return
      if (!getToken()) clearSession()
      else window.location.reload()
    },
  }
}

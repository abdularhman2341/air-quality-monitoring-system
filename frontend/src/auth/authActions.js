import { api, setToken } from '../api/client'
import { connectSocket, disconnectSocket } from '../realtime/socketClient'

// A new token from the server keeps this device signed in after every
// other session ended; the socket reconnects with it.
function keepWithNewToken({ token }) {
  setToken(token)
  disconnectSocket()
  connectSocket()
}

async function signIn(request, setUser) {
  const data = await request
  setToken(data.token)
  setUser(data.user)
}

// Calls that start, change or end this device's session.
export function sessionActions(setUser, clearSession) {
  return {
    login: (email, password) => signIn(api.login(email, password), setUser),
    activate: (email, code) => signIn(api.confirmSignup(email, code), setUser),
    async deleteAccount(currentPassword) {
      await api.deleteAccount(currentPassword)
      clearSession()
    },
    // No finally: if the request fails, the other devices are still signed in,
    // so this one must not look signed out.
    logoutAll: async (currentPassword) => keepWithNewToken(await api.logoutAll(currentPassword)),
    // The server ends every session and answers with a new token for this
    // device, the same as logoutAll().
    changePassword: async (currentPassword, newPassword) => {
      keepWithNewToken(await api.changePassword(currentPassword, newPassword))
    },
    // The session ends here at once; the server is told without waiting for
    // it, so a hanging request no longer leaves the button doing nothing
    // (F18). api.logout() reads the token as it starts, before it is
    // cleared. A failed request is ignored, as before: this device is out.
    logout() {
      const told = api.logout().catch(() => {})
      clearSession()
      return told.then(() => {})
    },
  }
}

// Calls that change the account; each answer is the updated account.
export function accountActions(setUser) {
  const save = async (request) => setUser(await request)
  return {
    // The account is saved inactive and a code is emailed: nobody is signed in
    // yet. activate() with that code signs in.
    register: (name, email, password) => api.register(name, email, password),
    updateProfile: (data) => save(api.updateMe(data)),
    changeEmail: (email, currentPassword) => save(api.changeEmail(email, currentPassword)),
    // The server keeps the old email and returns the account with pending_email
    // set. The email changes only in confirmEmailChange(), with the code that
    // was sent to the new address.
    confirmEmailChange: (code) => save(api.confirmEmailChange(code)),
    cancelEmailChange: () => save(api.cancelEmailChange()),
    // Re-reads the account, for example after an admin changed its role.
    // A 401 here signs out through the unauthorized handler.
    refreshUser: () => save(api.me()).catch(() => {}),
  }
}

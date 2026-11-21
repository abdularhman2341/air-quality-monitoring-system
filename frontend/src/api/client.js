// Every call to the backend goes through request(). VITE_API_URL is set at
// build time: http://localhost:3000/api/v1 locally, /api/v1 when the backend
// serves the site from the same domain.
const API_URL = import.meta.env.VITE_API_URL
export const TOKEN_KEY = 'aqms_token'

// The backend's { error: { code, message } } as an Error. Pages show it with
// errorText(err), which translates by code.
export class ApiError extends Error {
  constructor (status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

let onUnauthorized = () => {}

export function setUnauthorizedHandler (handler) {
  onUnauthorized = handler
}

// localStorage can throw (blocked storage, some private windows). Then the
// token is simply not kept, instead of the page crashing.
export function getToken () {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken (token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  } catch {
    return
  }
}

async function request (path, { method = 'GET', body } = {}) {
  const headers = {}
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  // fetch only throws when no answer came back at all (offline, server down).
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.')
  }

  if (res.status === 204) {
    return null
  }
  // An answer that is not JSON (a proxy error page, for example) becomes null.
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const error = data?.error || {}
    // Sign out only if the token that failed is still the current one: an old
    // request finishing after a new sign-in must not end the new session.
    if (res.status === 401 && getToken() === token) {
      onUnauthorized()
    }
    throw new ApiError(res.status, error.code || 'UNKNOWN_ERROR', error.message || 'Something went wrong.')
  }
  return data
}

// Builds the query string, skipping empty filters.
function query (params = {}) {
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(name, value)
    }
  }
  return search.toString()
}

// One function per backend route (backend/docs/openapi.yaml).
export const api = {
  register: (name, email, password) => request('/auth/register', { method: 'POST', body: { name, email, password } }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  logoutAll: (currentPassword) =>
    request('/auth/logout-all', { method: 'POST', body: { current_password: currentPassword } }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (email, code, newPassword) =>
    request('/auth/reset-password', { method: 'POST', body: { email, code, new_password: newPassword } }),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/me/password', {
      method: 'PATCH',
      body: { current_password: currentPassword, new_password: newPassword }
    }),
  me: () => request('/auth/me'),
  updateMe: (data) => request('/auth/me', { method: 'PATCH', body: data }),
  changeEmail: (email, currentPassword) =>
    request('/auth/me/email', { method: 'PATCH', body: { email, current_password: currentPassword } }),
  confirmEmailChange: (code) => request('/auth/me/email/confirm', { method: 'POST', body: { code } }),
  resendEmailChange: () => request('/auth/me/email/resend', { method: 'POST' }),
  cancelEmailChange: () => request('/auth/me/email/pending', { method: 'DELETE' }),
  confirmSignup: (email, code) => request('/auth/register/confirm', { method: 'POST', body: { email, code } }),
  resendSignupCode: (email) => request('/auth/register/resend', { method: 'POST', body: { email } }),
  deleteAccount: (currentPassword) =>
    request('/auth/me', { method: 'DELETE', body: { current_password: currentPassword } }),
  listDevices: () => request('/devices'),
  linkDevice: (device) => request('/devices', { method: 'POST', body: device }),
  unlinkDevice: (mac) => request(`/devices/${mac}`, { method: 'DELETE' }),
  readings: (mac, params) => request(`/devices/${mac}/readings?${query(params)}`),
  latestReading: (mac) => request(`/devices/${mac}/readings/latest`),
  alerts: (params) => request(`/alerts?${query(params)}`),
  admin: {
    actions: (params) => request(`/admin/actions?${query(params)}`),
    users: (params) => request(`/admin/users?${query(params)}`),
    user: (id) => request(`/admin/users/${id}`),
    updateUser: (id, data) => request(`/admin/users/${id}`, { method: 'PATCH', body: data }),
    deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
    logoutUser: (id) => request(`/admin/users/${id}/logout-all`, { method: 'POST' }),
    sendPasswordReset: (id) => request(`/admin/users/${id}/password-reset`, { method: 'POST' }),
    verifyUserEmail: (id) => request(`/admin/users/${id}/verify-email`, { method: 'POST' }),
    devices: (params) => request(`/admin/devices?${query(params)}`),
    registerDevice: (device) => request('/admin/devices', { method: 'POST', body: device }),
    updateDevice: (mac, data) => request(`/admin/devices/${mac}`, { method: 'PATCH', body: data }),
    deleteDevice: (mac) => request(`/admin/devices/${mac}`, { method: 'DELETE' }),
    newPairingCode: (mac) => request(`/admin/devices/${mac}/pairing-code`, { method: 'POST' }),
    readings: (mac, params) => request(`/admin/devices/${mac}/readings?${query(params)}`),
    alerts: (params) => request(`/admin/alerts?${query(params)}`),
    closeAlert: (id) => request(`/admin/alerts/${id}/close`, { method: 'POST' })
  }
}
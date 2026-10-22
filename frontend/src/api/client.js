const API_URL = import.meta.env.VITE_API_URL
const TOKEN_KEY = 'aqms_token'

export class ApiError extends Error {
  constructor (status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

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
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const error = data?.error || {}
    throw new ApiError(res.status, error.code || 'UNKNOWN_ERROR', error.message || 'Something went wrong.')
  }
  return data
}

export const api = {
  register: (name, email, password) => request('/auth/register', { method: 'POST', body: { name, email, password } }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  listDevices: () => request('/devices'),
  linkDevice: (device) => request('/devices', { method: 'POST', body: device }),
  readings: (mac, params) => request(`/devices/${mac}/readings?${new URLSearchParams(params)}`),
  latestReading: (mac) => request(`/devices/${mac}/readings/latest`)
}
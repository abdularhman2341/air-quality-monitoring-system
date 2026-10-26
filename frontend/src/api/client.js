const API_URL = import.meta.env.VITE_API_URL
const TOKEN_KEY = 'aqms_token'

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
    if (res.status === 401 && token) {
      onUnauthorized()
    }
    throw new ApiError(res.status, error.code || 'UNKNOWN_ERROR', error.message || 'Something went wrong.')
  }
  return data
}

function query (params = {}) {
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(name, value)
    }
  }
  return search.toString()
}

export const api = {
  register: (name, email, password) => request('/auth/register', { method: 'POST', body: { name, email, password } }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  updateMe: (data) => request('/auth/me', { method: 'PATCH', body: data }),
  listDevices: () => request('/devices'),
  linkDevice: (device) => request('/devices', { method: 'POST', body: device }),
  readings: (mac, params) => request(`/devices/${mac}/readings?${query(params)}`),
  latestReading: (mac) => request(`/devices/${mac}/readings/latest`),
  alerts: (params) => request(`/alerts?${query(params)}`)
}
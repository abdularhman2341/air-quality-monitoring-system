import { describe, it, expect, vi, beforeEach } from 'vitest'

// client.js reads VITE_API_URL when it loads, so set it first, then import.
vi.stubEnv('VITE_API_URL', 'http://api.test')
const { api, ApiError, getToken, setToken, setUnauthorizedHandler, TOKEN_KEY } =
  await import('../src/api/client.js')

// A small fake localStorage (Vitest runs in Node, which has none).
function fakeStorage() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  }
}

// A fake server answer, shaped like what fetch() returns.
function reply(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body
  }
}

let fetchMock

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  setUnauthorizedHandler(() => {})
})

describe('token storage', () => {
  it('saves, reads and removes the token', () => {
    expect(getToken()).toBeNull()
    setToken('abc')
    expect(getToken()).toBe('abc')
    expect(localStorage.getItem(TOKEN_KEY)).toBe('abc')
    setToken(null)
    expect(getToken()).toBeNull()
  })

  it('returns null when localStorage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') }
    })
    expect(getToken()).toBeNull()
  })
})

describe('requests', () => {
  it('sends a POST with a JSON body to the right URL', async () => {
    fetchMock.mockResolvedValue(reply(200, { token: 't1' }))
    const data = await api.login('a@b.com', 'secret123')

    expect(data).toEqual({ token: 't1' })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api.test/auth/login')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ email: 'a@b.com', password: 'secret123' })
  })

  it('sends a GET without a body or Content-Type', async () => {
    fetchMock.mockResolvedValue(reply(200, []))
    await api.listDevices()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api.test/devices')
    expect(options.method).toBe('GET')
    expect(options.body).toBeUndefined()
    expect(options.headers['Content-Type']).toBeUndefined()
  })

  it('adds the Bearer token when signed in', async () => {
    setToken('my-token')
    fetchMock.mockResolvedValue(reply(200, {}))
    await api.me()

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer my-token')
  })

  it('leaves empty values out of the query string', async () => {
    fetchMock.mockResolvedValue(reply(200, []))
    await api.alerts({ page: 2, status: '', from: null, to: undefined })

    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/alerts?page=2')
  })

  it('returns null for 204 No Content', async () => {
    fetchMock.mockResolvedValue(reply(204))
    expect(await api.logout()).toBeNull()
  })
})

describe('errors', () => {
  it('turns a server error into an ApiError with status and code', async () => {
    fetchMock.mockResolvedValue(
      reply(409, { error: { code: 'EMAIL_TAKEN', message: 'Email already used.' } })
    )

    const error = await api.register('A', 'a@b.com', 'secret123').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(409)
    expect(error.code).toBe('EMAIL_TAKEN')
    expect(error.message).toBe('Email already used.')
  })

  it('uses UNKNOWN_ERROR when the error has no body', async () => {
    fetchMock.mockResolvedValue({ status: 500, ok: false, json: async () => { throw new Error('not json') } })

    const error = await api.me().catch((e) => e)
    expect(error.code).toBe('UNKNOWN_ERROR')
  })

  it('throws NETWORK_ERROR when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await api.me().catch((e) => e)
    expect(error.status).toBe(0)
    expect(error.code).toBe('NETWORK_ERROR')
  })

  it('calls the unauthorized handler on 401', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    setToken('old-token')
    fetchMock.mockResolvedValue(reply(401, { error: { code: 'INVALID_TOKEN' } }))

    await api.me().catch(() => {})
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not call it if the token changed while the request was running', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    setToken('old-token')
    fetchMock.mockImplementation(async () => {
      setToken('new-token') // the user signed in again meanwhile
      return reply(401, { error: { code: 'INVALID_TOKEN' } })
    })

    await api.me().catch(() => {})
    expect(handler).not.toHaveBeenCalled()
  })
})

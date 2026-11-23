// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

const mocks = vi.hoisted(() => {
  let unauthorized = () => {}
  let serverDisconnect = () => {}
  const store = new Map()
  return {
    store,
    api: {
      me: vi.fn(), login: vi.fn(), register: vi.fn(), confirmSignup: vi.fn(), updateMe: vi.fn(), changeEmail: vi.fn(),
      confirmEmailChange: vi.fn(), cancelEmailChange: vi.fn(), deleteAccount: vi.fn(), logoutAll: vi.fn(),
      changePassword: vi.fn(), logout: vi.fn(),
    },
    client: {
      TOKEN_KEY: 'aqms_token',
      getToken: () => (store.has('t') ? store.get('t') : null),
      setToken: vi.fn((token) => (token ? store.set('t', token) : store.delete('t'))),
      setUnauthorizedHandler: (fn) => { unauthorized = fn },
      fireUnauthorized: () => unauthorized(),
    },
    socket: {
      connectSocket: vi.fn(), disconnectSocket: vi.fn(),
      setServerDisconnectHandler: (fn) => { serverDisconnect = fn },
      fireServerDisconnect: () => serverDisconnect(),
    },
  }
})
vi.mock('../../src/api/client', () => ({ api: mocks.api, ...mocks.client }))
vi.mock('../../src/realtime/socketClient', () => mocks.socket)

const { AuthProvider, useAuth } = await import('../../src/auth/AuthContext')

let ctx
// Keeps the latest context for the test to call; a component may not assign
// to an outer variable itself.
const keep = (value) => { ctx = value }
function Probe() {
  keep(useAuth())
  return <p data-testid="state">{JSON.stringify({ user: ctx.user, loading: ctx.loading, authError: ctx.authError?.code ?? null })}</p>
}
const state = () => JSON.parse(screen.getByTestId('state').textContent)
const flush = () => act(async () => {})
const USER = { id: 1, name: 'Sara' }

beforeEach(() => {
  mocks.store.clear()
  for (const fn of Object.values(mocks.api)) fn.mockReset()
  mocks.client.setToken.mockClear()
  mocks.socket.connectSocket.mockClear()
  mocks.socket.disconnectSocket.mockClear()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('AuthProvider', () => {
  it('with no token: not loading, nobody signed in, no request', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await flush()
    expect(state()).toEqual({ user: null, loading: false, authError: null })
    expect(mocks.api.me).not.toHaveBeenCalled()
    expect(mocks.socket.disconnectSocket).toHaveBeenCalled()
  })

  it('with a token: loads the account, then connects the socket', async () => {
    mocks.store.set('t', 'tok')
    mocks.api.me.mockResolvedValue(USER)
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(state().loading).toBe(true)
    await flush()
    expect(state()).toEqual({ user: USER, loading: false, authError: null })
    expect(mocks.socket.connectSocket).toHaveBeenCalled()
  })

  it('keeps a non-401 load error, and ignores a 401', async () => {
    mocks.store.set('t', 'tok')
    mocks.api.me.mockRejectedValue({ status: 503, code: 'DATABASE_UNAVAILABLE' })
    render(<AuthProvider><Probe /></AuthProvider>)
    await flush()
    expect(state()).toEqual({ user: null, loading: false, authError: 'DATABASE_UNAVAILABLE' })
    cleanup()
    mocks.api.me.mockRejectedValue({ status: 401, code: 'UNAUTHORIZED' })
    render(<AuthProvider><Probe /></AuthProvider>)
    await flush()
    expect(state().authError).toBe(null)
  })

  it('login, logout and the unauthorized handler set and clear the session', async () => {
    mocks.api.login.mockResolvedValue({ token: 'new', user: USER })
    mocks.api.logout.mockRejectedValue(new Error('offline'))
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(() => ctx.login('a@b.c', 'pw'))
    expect(mocks.api.login).toHaveBeenCalledWith('a@b.c', 'pw')
    expect(mocks.store.get('t')).toBe('new')
    expect(state().user).toEqual(USER)
    await act(() => ctx.logout().catch(() => {}))
    expect(state().user).toBe(null)
    expect(mocks.store.has('t')).toBe(false)
    await act(() => ctx.login('a@b.c', 'pw'))
    act(() => mocks.client.fireUnauthorized())
    expect(state().user).toBe(null)
  })

  // F18: logout waited for the server, so a hanging request left the user
  // signed in with a button that did nothing. The request is still sent, with
  // the token, but the session ends here at once.
  it('logout ends the session at once, even if the server never answers', async () => {
    mocks.api.login.mockResolvedValue({ token: 'new', user: USER })
    let tokenSent
    mocks.api.logout.mockImplementation(() => {
      tokenSent = mocks.client.getToken()
      return new Promise(() => {})
    })
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(() => ctx.login('a@b.c', 'pw'))
    act(() => { ctx.logout() })
    await flush()
    expect(tokenSent).toBe('new')
    expect(state().user).toBe(null)
    expect(mocks.store.has('t')).toBe(false)
  })

  it('a late answer to an old logout does not sign out the next sign-in', async () => {
    mocks.api.login.mockResolvedValue({ token: 'new', user: USER })
    let answer
    mocks.api.logout.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(() => ctx.login('a@b.c', 'pw'))
    act(() => { ctx.logout() })
    await act(() => ctx.login('a@b.c', 'pw'))
    await act(async () => answer(null))
    expect(state().user).toEqual(USER)
    expect(mocks.store.get('t')).toBe('new')
  })

  it('logout resolves when the server refuses, so the button never throws', async () => {
    mocks.api.login.mockResolvedValue({ token: 'new', user: USER })
    mocks.api.logout.mockRejectedValue(new Error('offline'))
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(() => ctx.login('a@b.c', 'pw'))
    await expect(act(() => ctx.logout())).resolves.toBeUndefined()
    expect(state().user).toBe(null)
  })

  it('register signs nobody in; activate does', async () => {
    mocks.api.register.mockResolvedValue({ email: 'a@b.c' })
    mocks.api.confirmSignup.mockResolvedValue({ token: 'tok', user: USER })
    render(<AuthProvider><Probe /></AuthProvider>)
    await expect(act(() => ctx.register('Sara', 'a@b.c', 'pw'))).resolves.toEqual({ email: 'a@b.c' })
    expect(state().user).toBe(null)
    await act(() => ctx.activate('a@b.c', '123456'))
    expect(mocks.api.confirmSignup).toHaveBeenCalledWith('a@b.c', '123456')
    expect(state().user).toEqual(USER)
  })

  it('account calls replace the user with the server answer', async () => {
    mocks.api.login.mockResolvedValue({ token: 'tok', user: USER })
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(() => ctx.login('a@b.c', 'pw'))
    const calls = [
      ['updateProfile', 'updateMe', [{ name: 'N' }]],
      ['changeEmail', 'changeEmail', ['n@b.c', 'pw']],
      ['confirmEmailChange', 'confirmEmailChange', ['123456']],
      ['cancelEmailChange', 'cancelEmailChange', []],
    ]
    for (const [method, apiName, args] of calls) {
      mocks.api[apiName].mockResolvedValue({ ...USER, name: method })
      await act(() => ctx[method](...args))
      expect(mocks.api[apiName]).toHaveBeenCalledWith(...args)
      expect(state().user.name).toBe(method)
    }
    mocks.api.me.mockResolvedValue({ ...USER, name: 'fresh' })
    await act(() => ctx.refreshUser())
    expect(state().user.name).toBe('fresh')
    mocks.api.me.mockRejectedValue(new Error('x'))
    await act(() => ctx.refreshUser())
    expect(state().user.name).toBe('fresh')
  })

  it('logoutAll and changePassword keep this device with the new token and reconnect', async () => {
    mocks.api.login.mockResolvedValue({ token: 'tok', user: USER })
    mocks.api.logoutAll.mockResolvedValue({ token: 'tok2' })
    mocks.api.changePassword.mockResolvedValue({ token: 'tok3' })
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(() => ctx.login('a@b.c', 'pw'))
    mocks.socket.connectSocket.mockClear()
    await act(() => ctx.logoutAll('pw'))
    expect(mocks.store.get('t')).toBe('tok2')
    expect(mocks.socket.disconnectSocket).toHaveBeenCalled()
    expect(mocks.socket.connectSocket).toHaveBeenCalledTimes(1)
    await act(() => ctx.changePassword('pw', 'new-pw'))
    expect(mocks.api.changePassword).toHaveBeenCalledWith('pw', 'new-pw')
    expect(mocks.store.get('t')).toBe('tok3')
    expect(state().user).toEqual(USER)
    mocks.api.logoutAll.mockRejectedValue(new Error('wrong'))
    await expect(act(() => ctx.logoutAll('bad'))).rejects.toThrow('wrong')
    expect(mocks.store.get('t')).toBe('tok3')
  })

  it('deleteAccount clears the session only after the server agrees', async () => {
    mocks.api.login.mockResolvedValue({ token: 'tok', user: USER })
    mocks.api.deleteAccount.mockRejectedValueOnce(new Error('wrong')).mockResolvedValueOnce(null)
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(() => ctx.login('a@b.c', 'pw'))
    await expect(act(() => ctx.deleteAccount('bad'))).rejects.toThrow('wrong')
    expect(state().user).toEqual(USER)
    await act(() => ctx.deleteAccount('pw'))
    expect(state().user).toBe(null)
  })

  it('signs out when another tab removes the token, and checks every second', async () => {
    vi.useFakeTimers()
    mocks.api.login.mockResolvedValue({ token: 'tok', user: USER })
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(() => ctx.login('a@b.c', 'pw'))
    mocks.store.delete('t')
    act(() => { vi.advanceTimersByTime(1000) })
    expect(state().user).toBe(null)
    await act(() => ctx.login('a@b.c', 'pw'))
    mocks.store.delete('t')
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'aqms_token' })) })
    expect(state().user).toBe(null)
    await act(() => ctx.login('a@b.c', 'pw'))
    mocks.store.delete('t')
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(state().user).toBe(null)
  })

  it('a logout that succeeds clears the session too', async () => {
    mocks.api.login.mockResolvedValue({ token: 'tok', user: USER })
    mocks.api.logout.mockResolvedValue(null)
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(() => ctx.login('a@b.c', 'pw'))
    await act(() => ctx.logout())
    expect(state().user).toBe(null)
    expect(mocks.store.has('t')).toBe(false)
  })

  it('another tab clearing all storage signs this one out', async () => {
    mocks.api.login.mockResolvedValue({ token: 'tok', user: USER })
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(() => ctx.login('a@b.c', 'pw'))
    mocks.store.delete('t')
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: null })) })
    expect(state().user).toBe(null)
  })

  it('reloads the page when another tab signs in as someone else, and ignores other keys', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    mocks.api.login.mockResolvedValue({ token: 'tok', user: USER })
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(() => ctx.login('a@b.c', 'pw'))
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'aqms_lang' })) })
    expect(reload).not.toHaveBeenCalled()
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'aqms_token' })) })
    expect(reload).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('after the server drops the socket, a valid session reconnects', async () => {
    mocks.api.me.mockResolvedValue(USER)
    render(<AuthProvider><Probe /></AuthProvider>)
    await flush()
    mocks.socket.connectSocket.mockClear()
    await act(async () => { mocks.socket.fireServerDisconnect() })
    expect(mocks.api.me).toHaveBeenCalled()
    expect(mocks.socket.connectSocket).toHaveBeenCalledTimes(1)
  })
})

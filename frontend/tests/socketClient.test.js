import { describe, it, expect, vi, beforeEach } from 'vitest'

// A fake socket that records its handlers, so the test can fire events.
const fake = vi.hoisted(() => ({ handlers: {} }))
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: (event, fn) => { fake.handlers[event] = fn },
    disconnect: () => {},
  }),
}))
vi.mock('../src/api/client', () => ({ getToken: () => 'tok' }))
vi.stubEnv('VITE_API_URL', '/api/v1')
const { connectSocket, disconnectSocket, onLiveUpdate } = await import('../src/realtime/socketClient')

beforeEach(() => {
  disconnectSocket()
  fake.handlers = {}
  connectSocket()
})

// F10: listeners now get the event name and its data, so a view can skip the
// events about something it does not show.
describe('socketClient live events', () => {
  it.each(['reading:new', 'alert:new', 'device:status'])('%s reaches listeners with its name and data', (event) => {
    const listener = vi.fn()
    const stop = onLiveUpdate(listener)
    fake.handlers[event]({ device_id: 'A4CF123B9E01' })
    expect(listener).toHaveBeenCalledWith(event, { device_id: 'A4CF123B9E01' })
    stop()
  })

  it('a (re)connect reaches listeners as "connect"', () => {
    const listener = vi.fn()
    const stop = onLiveUpdate(listener)
    fake.handlers.connect()
    expect(listener).toHaveBeenCalledWith('connect', undefined)
    stop()
  })

  it('a stopped listener hears nothing more', () => {
    const listener = vi.fn()
    onLiveUpdate(listener)()
    fake.handlers['reading:new']({})
    expect(listener).not.toHaveBeenCalled()
  })
})

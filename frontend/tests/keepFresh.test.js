import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const live = vi.hoisted(() => ({ listeners: new Set() }))
vi.mock('../src/realtime/socketClient', () => ({
  onLiveUpdate: (fn) => { live.listeners.add(fn); return () => live.listeners.delete(fn) },
}))
const { keepFresh } = await import('../src/hooks/keepFresh')

const emit = (event = 'connect', data) => { for (const fn of [...live.listeners]) fn(event, data) }
const settle = () => vi.advanceTimersByTimeAsync(0)
function pending() {
  let resolve
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  live.listeners.clear()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

// The loop behind useApiData and useDevices (F10, F11).
describe('keepFresh', () => {
  it('a load queued during a running one does not start after stop', async () => {
    const first = pending()
    const load = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue('x')
    const stop = keepFresh(load, 1000)
    emit()
    stop()
    first.resolve()
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('stop removes the timer and the live listener', async () => {
    const load = vi.fn().mockResolvedValue('x')
    const stop = keepFresh(load, 1000)
    await settle()
    expect(vi.getTimerCount()).toBe(1)
    expect(live.listeners.size).toBe(1)
    stop()
    expect(vi.getTimerCount()).toBe(0)
    expect(live.listeners.size).toBe(0)
    emit()
    await vi.advanceTimersByTimeAsync(5000)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['throws at once', () => { throw new Error('sync') }],
    ['rejects', () => Promise.reject(new Error('async'))],
  ])('a load that %s does not stop the next one', async (_name, bad) => {
    const load = vi.fn().mockImplementationOnce(bad).mockResolvedValue('x')
    keepFresh(load, 0)
    await settle()
    emit()
    await settle()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('no refreshMs means no timer', () => {
    keepFresh(vi.fn().mockResolvedValue('x'))
    expect(vi.getTimerCount()).toBe(0)
  })
})

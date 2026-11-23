// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

const live = vi.hoisted(() => ({ listeners: new Set() }))
vi.mock('../../src/realtime/socketClient', () => ({
  onLiveUpdate: (fn) => { live.listeners.add(fn); return () => live.listeners.delete(fn) },
}))
const { useApiData } = await import('../../src/hooks/useApiData')

function Probe({ request, dataKey, refreshMs }) {
  const { data, error, loading } = useApiData(request, dataKey, refreshMs)
  return <p data-testid="s">{JSON.stringify({ data, error: error?.message ?? null, loading })}</p>
}
const shown = () => JSON.parse(screen.getByTestId('s').textContent)
const flush = () => act(async () => {})

beforeEach(() => live.listeners.clear())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useApiData', () => {
  it('a null key loads nothing and is not loading', async () => {
    const request = vi.fn()
    render(<Probe request={request} dataKey={null} />)
    await flush()
    expect(shown()).toEqual({ data: null, error: null, loading: false })
    expect(request).not.toHaveBeenCalled()
  })

  it('loads, then reloads on a timer and on live events', async () => {
    vi.useFakeTimers()
    let n = 0
    const request = vi.fn(async () => ++n)
    render(<Probe request={request} dataKey="a" refreshMs={5000} />)
    expect(shown()).toEqual({ data: null, error: null, loading: true })
    await flush()
    expect(shown()).toEqual({ data: 1, error: null, loading: false })
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(shown().data).toBe(2)
    await act(async () => { for (const fn of live.listeners) fn() })
    expect(shown().data).toBe(3)
  })

  it('keeps the last good data of the same key next to an error', async () => {
    const request = vi.fn().mockResolvedValueOnce('good').mockRejectedValueOnce(new Error('down'))
    render(<Probe request={request} dataKey="a" />)
    await flush()
    await act(async () => { for (const fn of live.listeners) fn() })
    expect(shown()).toEqual({ data: 'good', error: 'down', loading: false })
  })

  it('a new key never shows the old key data, and an old answer is ignored', async () => {
    let resolveOld
    const old = new Promise((resolve) => { resolveOld = resolve })
    const request = vi.fn().mockReturnValueOnce(old).mockResolvedValueOnce('B')
    const { rerender } = render(<Probe request={request} dataKey="a" />)
    rerender(<Probe request={request} dataKey="b" />)
    expect(shown().loading).toBe(true)
    await flush()
    expect(shown().data).toBe('B')
    await act(async () => { resolveOld('A') })
    expect(shown().data).toBe('B')
  })

  it('an error for a new key shows no data from the old key', async () => {
    const request = vi.fn().mockResolvedValueOnce('A').mockRejectedValueOnce(new Error('nope'))
    const { rerender } = render(<Probe request={request} dataKey="a" />)
    await flush()
    rerender(<Probe request={request} dataKey="b" />)
    await flush()
    expect(shown()).toEqual({ data: null, error: 'nope', loading: false })
  })

  // F11: two requests used to run side by side, and the one that answered
  // last won, even when it was the older one.
  it('an older answer never replaces a newer one: one request at a time', async () => {
    let resolveOld
    const request = vi.fn()
      .mockResolvedValueOnce('first')
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
      .mockResolvedValueOnce('newest')
    render(<Probe request={request} dataKey="a" />)
    await flush()
    await act(async () => { for (const fn of live.listeners) fn() })
    await act(async () => { for (const fn of live.listeners) fn() })
    expect(request).toHaveBeenCalledTimes(2)
    await act(async () => { resolveOld('old') })
    await flush()
    expect(request).toHaveBeenCalledTimes(3)
    expect(shown().data).toBe('newest')
  })

  it('a request that throws before it starts does not stop later loads', async () => {
    const request = vi.fn()
      .mockImplementationOnce(() => { throw new Error('bad') })
      .mockResolvedValueOnce('ok')
    render(<Probe request={request} dataKey="a" />)
    await flush()
    expect(shown().error).toBe('bad')
    await act(async () => { for (const fn of live.listeners) fn() })
    expect(shown()).toEqual({ data: 'ok', error: null, loading: false })
  })

  it('reloads only for the live events its filter accepts', async () => {
    const request = vi.fn(async () => 'x')
    function Filtered() {
      useApiData(request, 'a', undefined, (event) => event === 'wanted')
      return null
    }
    render(<Filtered />)
    await flush()
    await act(async () => { for (const fn of live.listeners) fn('other', {}) })
    expect(request).toHaveBeenCalledTimes(1)
    await act(async () => { for (const fn of live.listeners) fn('wanted', {}) })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('always calls the newest request function, and stops on unmount', async () => {
    vi.useFakeTimers()
    const first = vi.fn(async () => 'first')
    const second = vi.fn(async () => 'second')
    const { rerender, unmount } = render(<Probe request={first} dataKey="a" refreshMs={1000} />)
    await flush()
    rerender(<Probe request={second} dataKey="a" refreshMs={1000} />)
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(shown().data).toBe('second')
    unmount()
    expect(live.listeners.size).toBe(0)
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(second).toHaveBeenCalledTimes(1)
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, act, fireEvent } from '@testing-library/react'
import { renderPage } from './setup'

// F10: every live event reloaded every list on the page, so one reading cost
// three requests per open tab. Now a view reloads only for events about what
// it shows, and a burst of events during a request costs one more request.
const live = vi.hoisted(() => ({ listeners: new Set() }))
const api = vi.hoisted(() => ({ listDevices: vi.fn(), readings: vi.fn(), alerts: vi.fn() }))
vi.mock('../../src/api/client', () => ({ api }))
vi.mock('../../src/realtime/socketClient', () => ({
  onLiveUpdate: (fn) => { live.listeners.add(fn); return () => live.listeners.delete(fn) },
}))
const { default: Dashboard } = await import('../../src/pages/dashboard/Dashboard')
const { default: History } = await import('../../src/pages/history/History')

const KITCHEN = {
  device_id: 'A4CF123B9E01', mac_display: 'A4:CF:12:3B:9E:01', name: 'Kitchen',
  connection_state: 'online', last_reading_at: '2026-11-21T11:59:00Z',
  latest: { lpg_ppm_est: 120, alarm_active: false, seq: 300 },
}
const GARAGE = { ...KITCHEN, device_id: 'A4CF123B9E7F', mac_display: 'A4:CF:12:3B:9E:7F', name: 'Garage' }
const flush = () => act(async () => {})
const emit = (event, data) => act(async () => { for (const fn of [...live.listeners]) fn(event, data) })
const calls = () => [api.listDevices.mock.calls.length, api.readings.mock.calls.length, api.alerts.mock.calls.length]

beforeEach(() => {
  live.listeners.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-21T12:00:00Z'))
  api.listDevices.mockReset().mockResolvedValue([KITCHEN, GARAGE])
  api.readings.mockReset().mockResolvedValue({ data: [], total: 0 })
  api.alerts.mockReset().mockResolvedValue({ data: [], total: 0 })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Dashboard live events (F10)', () => {
  // [devices, readings, alerts] after each event, starting from one load each.
  it.each([
    ['a reading of another device reloads the device list only', 'reading:new', { device_id: GARAGE.device_id }, [2, 1, 1]],
    ['a reading of the shown device reloads the list and the chart', 'reading:new', { device_id: KITCHEN.device_id, alarm_active: false }, [2, 2, 1]],
    ['a reading during an alarm also reloads the alert (its peak)', 'reading:new', { device_id: KITCHEN.device_id, alarm_active: true }, [2, 2, 2]],
    ['an alert of the shown device reloads the list and the alert', 'alert:new', { device_id: KITCHEN.device_id }, [2, 1, 2]],
    ['an alert of another device reloads the list only', 'alert:new', { device_id: GARAGE.device_id }, [2, 1, 1]],
    ['a status change reloads the list only', 'device:status', { device_id: KITCHEN.device_id, state: 'offline' }, [2, 1, 1]],
    ['a (re)connect reloads everything, since events may have been missed', 'connect', undefined, [2, 2, 2]],
  ])('%s', async (_name, event, data, expected) => {
    renderPage(<Dashboard />)
    await flush()
    expect(calls()).toEqual([1, 1, 1])
    await emit(event, data)
    expect(calls()).toEqual(expected)
  })

  it('a burst of events during a request costs one more request, not one each', async () => {
    renderPage(<Dashboard />)
    await flush()
    let finish
    api.listDevices.mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve([KITCHEN, GARAGE]) }))
    for (let i = 0; i < 5; i += 1) await emit('device:status', { device_id: KITCHEN.device_id })
    expect(api.listDevices).toHaveBeenCalledTimes(2)
    await act(async () => finish())
    expect(api.listDevices).toHaveBeenCalledTimes(3)
    await flush()
    expect(api.listDevices).toHaveBeenCalledTimes(3)
  })
})

describe('History live events (F10)', () => {
  it('the alerts tab reloads on alerts and alarm readings, not on every reading', async () => {
    renderPage(<History />)
    await flush()
    expect(api.alerts).toHaveBeenCalledTimes(1)
    await emit('reading:new', { device_id: KITCHEN.device_id, alarm_active: false })
    expect(api.alerts).toHaveBeenCalledTimes(1)
    await emit('alert:new', { device_id: GARAGE.device_id })
    expect(api.alerts).toHaveBeenCalledTimes(2)
    await emit('reading:new', { device_id: GARAGE.device_id, alarm_active: true })
    expect(api.alerts).toHaveBeenCalledTimes(3)
  })

  it('a device filter on the alerts tab ignores the other devices', async () => {
    renderPage(<History />)
    await flush()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: KITCHEN.device_id } })
    await flush()
    const before = api.alerts.mock.calls.length
    await emit('alert:new', { device_id: GARAGE.device_id })
    expect(api.alerts).toHaveBeenCalledTimes(before)
    await emit('alert:new', { device_id: KITCHEN.device_id })
    expect(api.alerts).toHaveBeenCalledTimes(before + 1)
  })

  it('the readings tab reloads on readings of its device only', async () => {
    renderPage(<History />)
    await flush()
    fireEvent.click(screen.getByRole('tab', { name: 'Readings' }))
    await flush()
    expect(api.readings).toHaveBeenCalledTimes(1)
    await emit('reading:new', { device_id: GARAGE.device_id })
    await emit('alert:new', { device_id: KITCHEN.device_id })
    expect(api.readings).toHaveBeenCalledTimes(1)
    await emit('reading:new', { device_id: KITCHEN.device_id })
    expect(api.readings).toHaveBeenCalledTimes(2)
  })
})

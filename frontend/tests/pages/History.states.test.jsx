// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, act, fireEvent } from '@testing-library/react'
import { renderPage, apiError } from './setup'

const api = vi.hoisted(() => ({ listDevices: vi.fn(), readings: vi.fn(), alerts: vi.fn() }))
vi.mock('../../src/api/client', () => ({ api }))
vi.mock('../../src/realtime/socketClient', () => ({ onLiveUpdate: () => () => {} }))
const { default: History } = await import('../../src/pages/history/History')

const NOW = new Date('2026-11-21T12:00:00Z')
const KITCHEN = { device_id: 'A4CF123B9E01', mac_display: 'A4:CF:12:3B:9E:01', name: 'Kitchen' }
const GARAGE = { device_id: 'A4CF123B9E7F', mac_display: 'A4:CF:12:3B:9E:7F', name: null }
const ALERTS = { total: 3, data: [
  { id: 3, device_id: KITCHEN.device_id, started_at: '2026-11-21T11:30:00Z', ended_at: null, peak_lpg_ppm_est: 1450, threshold_ppm: 1000 },
  { id: 2, device_id: GARAGE.device_id, started_at: '2026-11-20T08:00:00Z', ended_at: '2026-11-20T09:05:30Z', peak_lpg_ppm_est: 1200, threshold_ppm: 1000 },
  { id: 1, device_id: 'FFFFFFFFFFFF', started_at: '2026-11-19T08:00:00Z', ended_at: '2026-11-19T08:00:42Z', peak_lpg_ppm_est: 1010.4, threshold_ppm: 1000 },
] }
const READINGS = { total: 2, data: [
  { id: 11, reading_time: '2026-11-21T11:59:00Z', lpg_ppm_est: 1300, alarm_active: true },
  { id: 10, reading_time: '2026-11-21T11:58:00Z', lpg_ppm_est: 120, alarm_active: false },
] }
const flush = () => act(async () => {})
const tab = (name) => screen.getByRole('tab', { name })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  api.listDevices.mockReset().mockResolvedValue([KITCHEN, GARAGE])
  api.alerts.mockReset().mockResolvedValue(ALERTS)
  api.readings.mockReset().mockResolvedValue(READINGS)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// F12: when the devices request failed, the readings tab said "Link a sensor"
// as if the user had none. It also said so while the list was still loading.
describe('History when the device list is not there (F12)', () => {
  it('a failed device list shows its error, not "link a sensor"', async () => {
    api.listDevices.mockRejectedValue(apiError('NETWORK_ERROR', 'Cannot reach the server.', 0))
    const { container } = renderPage(<History />)
    await flush()
    fireEvent.click(tab('Readings'))
    await flush()
    expect(screen.getByRole('alert').textContent).toBe('Cannot reach the server.')
    expect(container.textContent).not.toContain('Link a sensor')
  })

  it('says it in Arabic too', async () => {
    api.listDevices.mockRejectedValue(apiError('NETWORK_ERROR', 'Cannot reach the server.', 0))
    renderPage(<History />, { lang: 'ar' })
    await flush()
    fireEvent.click(tab('القراءات'))
    await flush()
    expect(screen.getByRole('alert').textContent).toBe('تعذّر الاتصال بالخادم. تحقق من اتصالك وحاول مرة أخرى.')
  })

  it('says loading while the device list is on its way', async () => {
    api.listDevices.mockReturnValue(new Promise(() => {}))
    const { container } = renderPage(<History />)
    await flush()
    fireEvent.click(tab('Readings'))
    await flush()
    expect(container.querySelector('.table-message').textContent).toBe('Loading…')
  })

  it('the alerts tab does not wait for the device list', async () => {
    api.listDevices.mockReturnValue(new Promise(() => {}))
    api.alerts.mockResolvedValue({ total: 0, data: [] })
    const { container } = renderPage(<History />)
    await flush()
    expect(container.querySelector('.table-message').textContent).toBe('No alerts in this period.')
  })

  it('the alerts tab still works without the device list', async () => {
    api.listDevices.mockRejectedValue(apiError('NETWORK_ERROR', 'Cannot reach the server.', 0))
    const { container } = renderPage(<History />)
    await flush()
    expect(screen.queryByRole('alert')).toBe(null)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3)
  })
})

// F17: the tabs had no panel to point at and no arrow keys (WAI-ARIA tabs).
describe('History tabs with the keyboard (F17)', () => {
  it('each tab controls the one panel, which is labelled by the selected tab', async () => {
    renderPage(<History />)
    await flush()
    const panel = screen.getByRole('tabpanel')
    expect(tab('Alerts').getAttribute('aria-controls')).toBe(panel.id)
    expect(tab('Readings').getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.getAttribute('aria-labelledby')).toBe(tab('Alerts').id)
    expect([tab('Alerts').tabIndex, tab('Readings').tabIndex]).toEqual([0, -1])
    fireEvent.click(tab('Readings'))
    await flush()
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(tab('Readings').id)
    expect([tab('Alerts').tabIndex, tab('Readings').tabIndex]).toEqual([-1, 0])
  })

  it.each([
    ['ArrowRight', 'Readings'], ['ArrowLeft', 'Readings'], ['End', 'Readings'], ['Home', 'Alerts'],
  ])('%s from Alerts selects and focuses %s', async (key, expected) => {
    renderPage(<History />)
    await flush()
    tab('Alerts').focus()
    fireEvent.keyDown(tab('Alerts'), { key })
    await flush()
    expect(tab(expected).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tab(expected))
  })

  it('other keys change nothing, on either tab', async () => {
    renderPage(<History />)
    await flush()
    fireEvent.keyDown(tab('Alerts'), { key: 'ArrowDown' })
    fireEvent.keyDown(tab('Alerts'), { key: 'a' })
    await flush()
    expect(tab('Alerts').getAttribute('aria-selected')).toBe('true')
    fireEvent.click(tab('Readings'))
    fireEvent.keyDown(tab('Readings'), { key: 'Enter' })
    await flush()
    expect(tab('Readings').getAttribute('aria-selected')).toBe('true')
  })
})

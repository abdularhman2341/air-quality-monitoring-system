// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, act, fireEvent } from '@testing-library/react'
import { renderPage, apiError, html } from './setup'

const api = vi.hoisted(() => ({ listDevices: vi.fn(), readings: vi.fn(), alerts: vi.fn() }))
const downloadCsv = vi.hoisted(() => vi.fn())
vi.mock('../../src/api/client', () => ({ api }))
vi.mock('../../src/realtime/socketClient', () => ({ onLiveUpdate: () => () => {} }))
vi.mock('../../src/utils/csv', () => ({ downloadCsv }))
const { default: History } = await import('../../src/pages/history/History')

const NOW = new Date('2026-11-21T12:00:00Z')
const daysAgo = (days) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
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
const table = (container) => html(container.querySelector('.table-card'), { outer: true })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  api.listDevices.mockReset().mockResolvedValue([KITCHEN, GARAGE])
  api.alerts.mockReset().mockResolvedValue(ALERTS)
  api.readings.mockReset().mockResolvedValue(READINGS)
  downloadCsv.mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('History alerts tab', () => {
  it('asks for every device in the last 30 days, page 1', async () => {
    renderPage(<History />)
    await flush()
    expect(api.alerts).toHaveBeenLastCalledWith({ device_id: undefined, from: daysAgo(30), page: 1, limit: 50 })
    expect(api.readings).not.toHaveBeenCalled()
  })

  it('renders the same page in English and Arabic', async () => {
    const { container } = renderPage(<History />)
    await flush()
    expect(html(container)).toMatchSnapshot()
    cleanup()
    const ar = renderPage(<History />, { lang: 'ar' })
    await flush()
    expect(html(ar.container)).toMatchSnapshot()
  })

  it('a device and a range filter the request and go back to page 1', async () => {
    api.alerts.mockResolvedValue({ ...ALERTS, total: 120 })
    const { container } = renderPage(<History />)
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await flush()
    expect(api.alerts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    fireEvent.change(container.querySelector('select'), { target: { value: GARAGE.device_id } })
    await flush()
    expect(api.alerts).toHaveBeenLastCalledWith({ device_id: GARAGE.device_id, from: daysAgo(30), page: 1, limit: 50 })
    fireEvent.click(screen.getByRole('button', { name: '7 days' }))
    await flush()
    expect(api.alerts).toHaveBeenLastCalledWith({ device_id: GARAGE.device_id, from: daysAgo(7), page: 1, limit: 50 })
    expect(screen.getByRole('button', { name: '7 days' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '24 h' }))
    await flush()
    expect(api.alerts).toHaveBeenLastCalledWith(expect.objectContaining({ from: daysAgo(1) }))
  })

  it('pages through more than 50 rows', async () => {
    api.alerts.mockResolvedValue({ ...ALERTS, total: 120 })
    const { container } = renderPage(<History />)
    await flush()
    expect(html(container.querySelector('.pager'), { outer: true })).toMatchSnapshot()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await flush()
    expect(api.alerts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }))
    expect(html(container.querySelector('.pager'), { outer: true })).toMatchSnapshot()
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    await flush()
    expect(api.alerts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
  })

  it('no pager for 50 rows or fewer, and an empty period says so', async () => {
    api.alerts.mockResolvedValue({ total: 50, data: ALERTS.data })
    const { container } = renderPage(<History />)
    await flush()
    expect(container.querySelector('.pager')).toBeNull()
    cleanup()
    api.alerts.mockResolvedValue({ total: 0, data: [] })
    const empty = renderPage(<History />)
    await flush()
    expect(empty.container.querySelector('.table-message').textContent).toBe('No alerts in this period.')
    expect(screen.getByRole('button', { name: 'Export CSV' }).disabled).toBe(true)
  })

  it('shows loading until the answer, then a failed request as an error', async () => {
    api.alerts.mockReturnValue(new Promise(() => {}))
    const { container } = renderPage(<History />)
    await flush()
    expect(container.querySelector('.table-message').textContent).toBe('Loading…')
    cleanup()
    api.alerts.mockRejectedValue(apiError('DATABASE_UNAVAILABLE', 'Database is unavailable.', 503))
    const failed = renderPage(<History />)
    await flush()
    expect(table(failed.container)).toMatchSnapshot()
  })
})

describe('History readings tab', () => {
  it('shows the first device when the filter is all, without an all option', async () => {
    const { container } = renderPage(<History />)
    await flush()
    fireEvent.click(tab('Readings'))
    await flush()
    expect(api.readings).toHaveBeenLastCalledWith(KITCHEN.device_id, { from: daysAgo(30), page: 1, limit: 50 })
    expect(html(container.querySelector('.history'), { outer: true })).toMatchSnapshot()
  })

  it('a chosen device stays chosen when switching tabs', async () => {
    const { container } = renderPage(<History />)
    await flush()
    fireEvent.change(container.querySelector('select'), { target: { value: GARAGE.device_id } })
    await flush()
    fireEvent.click(tab('Readings'))
    await flush()
    expect(api.readings).toHaveBeenLastCalledWith(GARAGE.device_id, { from: daysAgo(30), page: 1, limit: 50 })
    expect(container.querySelector('select').value).toBe(GARAGE.device_id)
    expect(container.querySelector('tbody td.strong').textContent).toBe('A4:CF:12:3B:9E:7F')
  })

  it('with no devices it asks for nothing and says to link one; with none in range it says so', async () => {
    api.listDevices.mockResolvedValue([])
    const { container } = renderPage(<History />)
    await flush()
    fireEvent.click(tab('Readings'))
    await flush()
    expect(api.readings).not.toHaveBeenCalled()
    expect(container.querySelector('.table-message').textContent).toBe('Link a sensor to see its readings.')
    cleanup()
    api.listDevices.mockResolvedValue([KITCHEN])
    api.readings.mockResolvedValue({ total: 0, data: [] })
    const second = renderPage(<History />)
    await flush()
    fireEvent.click(tab('Readings'))
    await flush()
    expect(second.container.querySelector('.table-message').textContent).toBe('No readings in this period.')
  })
})

describe('History CSV export', () => {
  it('exports up to 1000 alerts of the same filter with device names', async () => {
    renderPage(<History />)
    await flush()
    fireEvent.click(screen.getByRole('button', { name: '7 days' }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await flush()
    expect(api.alerts).toHaveBeenLastCalledWith({ device_id: undefined, from: daysAgo(7), page: 1, limit: 1000 })
    expect(downloadCsv.mock.calls).toMatchSnapshot()
    expect(screen.getByRole('status').textContent).toBe('CSV exported')
  })

  it('exports the readings of the device on screen', async () => {
    renderPage(<History />)
    await flush()
    fireEvent.click(tab('Readings'))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await flush()
    expect(api.readings).toHaveBeenLastCalledWith(KITCHEN.device_id, { from: daysAgo(30), page: 1, limit: 1000 })
    expect(downloadCsv.mock.calls).toMatchSnapshot()
  })

  it('says Exporting while it runs, and shows a failure as a toast', async () => {
    renderPage(<History />)
    await flush()
    let fail
    api.alerts.mockReturnValue(new Promise((_resolve, reject) => { fail = reject }))
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await flush()
    expect(screen.getByRole('button', { name: 'Exporting…' }).disabled).toBe(true)
    await act(async () => fail(apiError('DATABASE_UNAVAILABLE', 'Database is unavailable.', 503)))
    expect(screen.getByRole('status').textContent).toBe('Database is unavailable.')
    expect(screen.getByRole('button', { name: 'Export CSV' }).disabled).toBe(false)
    expect(downloadCsv).not.toHaveBeenCalled()
  })
})

describe('History refresh', () => {
  it('asks again for the devices and the rows every minute', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(NOW)
    renderPage(<History />)
    await flush()
    expect(api.listDevices).toHaveBeenCalledTimes(1)
    expect(api.alerts).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTime(59999))
    expect(api.listDevices).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTime(1))
    expect(api.listDevices).toHaveBeenCalledTimes(2)
    expect(api.alerts).toHaveBeenCalledTimes(2)
  })
})

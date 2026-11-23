// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, act, fireEvent } from '@testing-library/react'
import { renderPage, apiError, html } from './setup'

const api = vi.hoisted(() => ({ listDevices: vi.fn(), readings: vi.fn(), alerts: vi.fn() }))
vi.mock('../../src/api/client', () => ({ api }))
vi.mock('../../src/realtime/socketClient', () => ({ onLiveUpdate: () => () => {} }))
const { default: Dashboard } = await import('../../src/pages/dashboard/Dashboard')

const NOW = new Date('2026-11-21T12:00:00Z')
const KITCHEN = {
  device_id: 'A4CF123B9E01', mac_display: 'A4:CF:12:3B:9E:01', name: 'Kitchen', location: 'Floor 1',
  connection_state: 'online', last_reading_at: '2026-11-21T11:59:00Z',
  latest: { lpg_ppm_est: 120, alarm_active: false, seq: 300 },
}
const GARAGE = {
  device_id: 'A4CF123B9E7F', mac_display: 'A4:CF:12:3B:9E:7F', name: null, location: null,
  connection_state: 'offline', last_reading_at: '2026-11-19T08:00:00Z',
  latest: { lpg_ppm_est: 1300, alarm_active: true, seq: 50 },
}
const READINGS = { data: [
  { reading_time: '2026-11-21T11:59:00Z', lpg_ppm_est: 120 },
  { reading_time: '2026-11-21T11:58:00Z', lpg_ppm_est: 118 },
] }
const OPEN_ALERT = { data: [{ started_at: '2026-11-21T11:30:00Z', ended_at: null, peak_lpg_ppm_est: 1450 }] }
const flush = () => act(async () => {})
const alertsCard = () => screen.getByText('Alerts').parentElement

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  api.listDevices.mockReset().mockResolvedValue([KITCHEN, GARAGE])
  api.readings.mockReset().mockResolvedValue(READINGS)
  api.alerts.mockReset().mockResolvedValue({ data: [] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Dashboard', () => {
  it('shows loading, then the first device', async () => {
    renderPage(<Dashboard />)
    expect(screen.getByText('Loading…')).toBeTruthy()
    await flush()
    expect(api.readings).toHaveBeenCalledWith('A4CF123B9E01', { limit: 30 })
    expect(api.alerts).toHaveBeenCalledWith({ device_id: 'A4CF123B9E01', limit: 1 })
  })

  it('renders the same safe page in English and Arabic', async () => {
    const { container } = renderPage(<Dashboard />)
    await flush()
    expect(html(container)).toMatchSnapshot()
    cleanup()
    const ar = renderPage(<Dashboard />, { lang: 'ar' })
    await flush()
    expect(html(ar.container)).toMatchSnapshot()
  })

  it('shows an open alert with its start and peak', async () => {
    api.alerts.mockResolvedValue(OPEN_ALERT)
    renderPage(<Dashboard />)
    await flush()
    expect(html(alertsCard(), { outer: true })).toMatchSnapshot()
  })

  it('a closed alert means no active alert', async () => {
    api.alerts.mockResolvedValue({ data: [{ ...OPEN_ALERT.data[0], ended_at: '2026-11-21T11:40:00Z' }] })
    renderPage(<Dashboard />)
    await flush()
    expect(alertsCard().textContent).toContain('No active alerts')
  })

  it('switches device from its pill, and an offline alarming device shows lost during a leak (F8)', async () => {
    const { container } = renderPage(<Dashboard />)
    await flush()
    fireEvent.click(screen.getByRole('button', { name: /A4:CF:12:3B:9E:7F/ }))
    await flush()
    expect(api.readings).toHaveBeenLastCalledWith('A4CF123B9E7F', { limit: 30 })
    expect(html(container.querySelector('.status-hero'), { outer: true })).toMatchSnapshot()
    expect(container.querySelector('.info-list').textContent).toMatchSnapshot()
  })

  it('opens on the device AddSensor linked', async () => {
    renderPage(<Dashboard />, { route: { pathname: '/', state: { selected: 'A4CF123B9E7F' } } })
    await flush()
    expect(api.readings).toHaveBeenCalledWith('A4CF123B9E7F', { limit: 30 })
  })

  it('an online device in an alarm shows the alert state, and a fresh one is warming up', async () => {
    api.listDevices.mockResolvedValue([{ ...KITCHEN, latest: { ...KITCHEN.latest, alarm_active: true } }])
    const { container } = renderPage(<Dashboard />)
    await flush()
    expect(container.querySelector('.status-hero').className).toBe('status-hero hero-alert')
    cleanup()
    api.listDevices.mockResolvedValue([{ ...KITCHEN, latest: { ...KITCHEN.latest, seq: 3 } }])
    const second = renderPage(<Dashboard />)
    await flush()
    expect(second.container.querySelector('.status-hero').className).toBe('status-hero hero-warming')
  })

  it('no readings yet says so', async () => {
    api.readings.mockResolvedValue({ data: [] })
    renderPage(<Dashboard />)
    await flush()
    expect(screen.getByText('No readings yet')).toBeTruthy()
  })

  it('no devices shows the empty state, and a failed list shows the error', async () => {
    api.listDevices.mockResolvedValue([])
    const { container } = renderPage(<Dashboard />)
    await flush()
    expect(html(container)).toMatchSnapshot()
    cleanup()
    api.listDevices.mockRejectedValue(apiError('DATABASE_UNAVAILABLE', 'Database is unavailable.', 503))
    renderPage(<Dashboard />)
    await flush()
    expect(screen.getByRole('alert').textContent).toBe('Database is unavailable.')
  })
})

// F3: the alerts card said "Everything looks normal" while it did not know.
describe('Dashboard alerts card when the alerts are not known (F3)', () => {
  it('a failed alerts request does not say all is normal', async () => {
    api.alerts.mockRejectedValue(apiError('DATABASE_UNAVAILABLE', 'Database is unavailable.', 503))
    renderPage(<Dashboard />)
    await flush()
    const card = alertsCard()
    expect(card.textContent).not.toContain('No active alerts')
    expect(card.textContent).not.toContain('Everything looks normal.')
    expect(card.textContent).toContain('Alert status unknown')
    expect(card.querySelector('[role=alert]').textContent).toBe('Database is unavailable.')
  })

  it('alerts that are still loading do not say all is normal', async () => {
    api.alerts.mockReturnValue(new Promise(() => {}))
    renderPage(<Dashboard />)
    await flush()
    const card = alertsCard()
    expect(card.textContent).not.toContain('No active alerts')
    expect(card.textContent).not.toContain('Everything looks normal.')
    expect(card.textContent).toContain('Loading…')
  })
})

// Found by mutation testing during the split: these three details had no test.
describe('Dashboard details pinned before the split', () => {
  it('an online device in an alarm pulses its dot and still says online', async () => {
    api.listDevices.mockResolvedValue([{ ...KITCHEN, latest: { ...KITCHEN.latest, alarm_active: true } }])
    const { container } = renderPage(<Dashboard />)
    await flush()
    expect(html(container.querySelector('.status-hero'), { outer: true })).toMatchSnapshot()
    expect(container.querySelector('.info-card .info-title').textContent).toBe('Online')
  })

  it('the unknown alert status is written in the warning color', async () => {
    api.alerts.mockRejectedValue(apiError('DATABASE_UNAVAILABLE', 'Database is unavailable.', 503))
    renderPage(<Dashboard />)
    await flush()
    expect(html(alertsCard(), { outer: true })).toMatchSnapshot()
  })
})

// F8: a device that went offline while its alarm was on showed grey
// "Offline", so the leak disappeared from the page. Decision (23 Nov): its
// own red state, "Lost during a leak".
describe('Dashboard device lost during a leak (F8)', () => {
  const LOST = { ...GARAGE, name: 'Garage' }
  const QUIET = { ...GARAGE, name: 'Store', latest: { ...GARAGE.latest, alarm_active: false } }

  it('shows the red lost state, still says offline, and does not pulse', async () => {
    api.listDevices.mockResolvedValue([LOST])
    const { container } = renderPage(<Dashboard />)
    await flush()
    const hero = container.querySelector('.status-hero')
    expect(hero.className).toBe('status-hero hero-lost')
    expect(hero.querySelector('.hero-word').textContent).toBe('LOST DURING A LEAK')
    expect(hero.querySelector('.hero-word').style.color).toBe('var(--danger-ink)')
    expect(hero.querySelector('.hero-message').textContent).toBe('The sensor stopped reporting while its alarm was on')
    expect(hero.querySelector('.hero-advice').textContent).toBe('Treat it as a leak until you check the place. Showing the last known reading.')
    expect(hero.querySelector('.dot').className).toBe('dot ')
    expect(container.querySelector('.info-card .info-title').textContent).toBe('Offline')
  })

  it('says it in Arabic', async () => {
    api.listDevices.mockResolvedValue([LOST])
    const { container } = renderPage(<Dashboard />, { lang: 'ar' })
    await flush()
    expect(container.querySelector('.hero-word').textContent).toBe('انقطع أثناء تسرّب')
    expect(container.querySelector('.hero-message').textContent).toBe('توقف الحساس عن الإرسال وإنذاره يعمل')
    expect(container.querySelector('.hero-advice').textContent).toBe('اعتبره تسرّبًا حتى تتحقق من المكان. المعروض آخر قراءة معروفة.')
  })

  it('an offline device whose last reading had no alarm still shows offline', async () => {
    api.listDevices.mockResolvedValue([QUIET])
    const { container } = renderPage(<Dashboard />)
    await flush()
    expect(container.querySelector('.status-hero').className).toBe('status-hero hero-offline')
    expect(container.querySelector('.hero-word').textContent).toBe('OFFLINE')
  })

  it('an offline device with no readings shows offline', async () => {
    api.listDevices.mockResolvedValue([{ ...GARAGE, latest: null }])
    const { container } = renderPage(<Dashboard />)
    await flush()
    expect(container.querySelector('.status-hero').className).toBe('status-hero hero-offline')
  })
})

// F6: the device buttons showed the state by color only. A state that is not
// normal now has a word on the button; "normal" is for screen readers only.
describe('Dashboard device buttons say their state (F6)', () => {
  const device = (name, fields) => ({ ...KITCHEN, device_id: `A4CF123B9E${name.length}0`, name, ...fields })
  const ALARM = device('Lab', { latest: { ...KITCHEN.latest, alarm_active: true } })
  const WARM = device('Hall', { latest: { ...KITCHEN.latest, seq: 3 } })
  const OFF = device('Store', { connection_state: 'offline' })
  const LOST = device('Garage', { connection_state: 'offline', latest: { ...KITCHEN.latest, alarm_active: true } })
  const pill = (name) => screen.getByRole('button', { name: new RegExp(`^${name}`) })
  const word = (name) => pill(name).querySelector('.pill-state')

  it('each button has its state as text', async () => {
    api.listDevices.mockResolvedValue([KITCHEN, ALARM, WARM, OFF, LOST])
    renderPage(<Dashboard />)
    await flush()
    expect(pill('Kitchen').textContent).toBe('Kitchen120Normal')
    expect(word('Kitchen').className).toBe('pill-state sr-only')
    expect(word('Lab').textContent).toBe('Leak')
    expect(word('Hall').textContent).toBe('Warming up')
    expect(word('Store').textContent).toBe('Offline')
    expect(word('Garage').textContent).toBe('Lost in a leak')
    expect(word('Lab').className).toBe('pill-state')
    expect(pill('Garage').className).toBe('device-pill pill-lost')
  })

  it('in Arabic too', async () => {
    api.listDevices.mockResolvedValue([KITCHEN, ALARM, WARM, OFF, LOST])
    renderPage(<Dashboard />, { lang: 'ar' })
    await flush()
    expect(['Kitchen', 'Lab', 'Hall', 'Store', 'Garage'].map((n) => word(n).textContent))
      .toEqual(['طبيعي', 'تسرّب', 'قيد التسخين', 'غير متصل', 'انقطع أثناء تسرّب'])
  })
})

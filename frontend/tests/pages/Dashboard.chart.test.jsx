// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, act } from '@testing-library/react'
import { renderPage, html } from './setup'

// jsdom has no layout, so the real chart draws nothing. Each chart part is
// replaced by a div that records the props it got; a formatter prop is
// recorded as what it returns for a sample time and a sample ppm. The
// snapshot then pins the chart's whole setup without a browser.
vi.mock('recharts', () => {
  const SAMPLES = ['2026-11-21T11:59:00Z', 1234]
  // Keys are sorted: the order props are written in changes nothing.
  const replacer = (_key, value) => {
    if (typeof value === 'function') {
      return `fn(${SAMPLES.map((s) => JSON.stringify(value(s))).join(' | ')})`
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.keys(value).sort().map((k) => [k, value[k]]))
    }
    return value
  }
  const part = (name) =>
    function ChartPart({ children, ...props }) {
      return (
        <div data-part={name} data-props={JSON.stringify(props, replacer)}>
          {children}
        </div>
      )
    }
  const names = ['Area', 'AreaChart', 'CartesianGrid', 'ReferenceLine', 'ResponsiveContainer', 'Tooltip', 'XAxis', 'YAxis']
  return Object.fromEntries(names.map((name) => [name, part(name)]))
})

const api = vi.hoisted(() => ({ listDevices: vi.fn(), readings: vi.fn(), alerts: vi.fn() }))
vi.mock('../../src/api/client', () => ({ api }))
vi.mock('../../src/realtime/socketClient', () => ({ onLiveUpdate: () => () => {} }))
const { default: Dashboard } = await import('../../src/pages/dashboard/Dashboard')

const KITCHEN = {
  device_id: 'A4CF123B9E01', mac_display: 'A4:CF:12:3B:9E:01', name: 'Kitchen', location: 'Floor 1',
  connection_state: 'online', last_reading_at: '2026-11-21T11:59:00Z',
  latest: { lpg_ppm_est: 120, alarm_active: false, seq: 300 },
}
// Newest first, as the API sends them. One reading is above GAUGE_MAX_PPM
// so the y axis has to grow past it.
const READINGS = { data: [
  { reading_time: '2026-11-21T11:59:00Z', lpg_ppm_est: 120 },
  { reading_time: '2026-11-21T11:58:00Z', lpg_ppm_est: 2600 },
  { reading_time: '2026-11-21T11:57:00Z', lpg_ppm_est: 118 },
] }
const flush = () => act(async () => {})
const readingsCard = (container) => html(container.querySelector('.readings-card'), { outer: true })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-21T12:00:00Z'))
  api.listDevices.mockReset().mockResolvedValue([KITCHEN])
  api.readings.mockReset().mockResolvedValue(READINGS)
  api.alerts.mockReset().mockResolvedValue({ data: [] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Dashboard readings chart', () => {
  it('draws the readings oldest first with the safe colors, in English and Arabic', async () => {
    const { container } = renderPage(<Dashboard />)
    await flush()
    expect(readingsCard(container)).toMatchSnapshot()
    cleanup()
    const ar = renderPage(<Dashboard />, { lang: 'ar' })
    await flush()
    expect(readingsCard(ar.container)).toMatchSnapshot()
  })

  it('takes the alert colors when the device is in an alarm', async () => {
    api.listDevices.mockResolvedValue([{ ...KITCHEN, latest: { ...KITCHEN.latest, alarm_active: true } }])
    const { container } = renderPage(<Dashboard />)
    await flush()
    expect(readingsCard(container)).toMatchSnapshot()
  })

  it('keeps the y axis at GAUGE_MAX_PPM when every reading is lower', async () => {
    api.readings.mockResolvedValue({ data: [READINGS.data[0]] })
    const { container } = renderPage(<Dashboard />)
    await flush()
    const axis = JSON.parse(container.querySelector('[data-part=YAxis]').dataset.props)
    expect(axis.domain).toEqual([0, 1800])
  })
})

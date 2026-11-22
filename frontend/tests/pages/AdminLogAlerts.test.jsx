// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, act, fireEvent, within } from '@testing-library/react'
import { renderPage, apiError, html } from './setup'

const auth = vi.hoisted(() => ({ refreshUser: vi.fn() }))
vi.mock('../../src/auth/AuthContext', () => ({ useAuth: () => auth }))
const api = vi.hoisted(() => ({ admin: { actions: vi.fn(), alerts: vi.fn(), closeAlert: vi.fn() } }))
vi.mock('../../src/api/client', () => ({ api }))
vi.mock('../../src/realtime/socketClient', () => ({ onLiveUpdate: () => () => {} }))
const { default: AdminLog } = await import('../../src/pages/admin/AdminLog')
const { default: AdminAlerts } = await import('../../src/pages/admin/AdminAlerts')
const { PairingCodeBox } = await import('../../src/pages/admin/shared')

const flush = () => act(async () => {})
const page = (container) => html(container)
const notAdmin = () => apiError('ADMIN_ONLY', 'Admins only.', 403)

const ACTIONS = { total: 4, data: [
  {
    id: 4, created_at: '2026-11-21T10:00:00Z', admin: { email: 'root@example.com' }, action: 'device.update',
    target_type: 'device', target_id: 'A4CF123B9E01', target_label: 'Kitchen',
    details: { name: { from: 'Kitchen', to: 'مطبخ' }, owner: { from: null, to: 'sara@example.com' }, history_deleted: true },
  },
  {
    id: 3, created_at: '2026-11-20T10:00:00Z', admin: { email: 'root@example.com' }, action: 'device.delete',
    target_type: 'device', target_id: 'A4CF123B9E7F', target_label: null,
    details: { owner: 'sara@example.com', location: null, history_deleted: false },
  },
  {
    id: 2, created_at: '2026-11-19T10:00:00Z', admin: null, action: 'user.promote',
    target_type: 'user', target_id: '7', target_label: 'Sara', details: null,
  },
  {
    id: 1, created_at: '2026-11-18T10:00:00Z', admin: { email: 'root@example.com' }, action: 'alert.close',
    target_type: 'alert', target_id: '12', target_label: 'Kitchen', details: { role: { from: 'user', to: 'admin' } },
  },
] }

const ALERTS = { total: 3, data: [
  {
    id: 12, device_id: 'A4CF123B9E01', started_at: '2026-11-21T11:30:00Z', ended_at: null, peak_lpg_ppm_est: 1450,
    device: { name: 'Kitchen', owner: { email: 'sara@example.com' } },
  },
  {
    id: 11, device_id: 'A4CF123B9E7F', started_at: '2026-11-20T08:00:00Z', ended_at: null, peak_lpg_ppm_est: 1100,
    device: { name: null, owner: null },
  },
  {
    id: 10, device_id: 'A4CF123B9E55', started_at: '2026-11-19T08:00:00Z', ended_at: '2026-11-19T08:05:00Z',
    peak_lpg_ppm_est: 1010, device: null,
  },
] }

beforeEach(() => {
  auth.refreshUser.mockReset()
  api.admin.actions.mockReset().mockResolvedValue(ACTIONS)
  api.admin.alerts.mockReset().mockResolvedValue(ALERTS)
  api.admin.closeAlert.mockReset().mockResolvedValue({})
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('AdminLog', () => {
  it('renders every kind of detail the same in English and Arabic', async () => {
    const { container } = renderPage(<AdminLog />)
    await flush()
    expect(api.admin.actions).toHaveBeenCalledWith({ page: 1, limit: 50 })
    expect(page(container)).toMatchSnapshot()
    cleanup()
    const ar = renderPage(<AdminLog />, { lang: 'ar' })
    await flush()
    expect(page(ar.container)).toMatchSnapshot()
  })

  it('shows loading, then no changes; pages through more than 50', async () => {
    let answer
    api.admin.actions.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    const { container } = renderPage(<AdminLog />)
    await flush()
    expect(container.querySelector('.table-message').textContent).toBe('Loading…')
    await act(async () => answer({ total: 0, data: [] }))
    expect(container.querySelector('.table-message').textContent).toBe('No changes yet.')
    expect(container.querySelector('.pager')).toBeNull()
    cleanup()
    api.admin.actions.mockResolvedValue({ ...ACTIONS, total: 120 })
    renderPage(<AdminLog />)
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await flush()
    expect(api.admin.actions).toHaveBeenLastCalledWith({ page: 2, limit: 50 })
  })

  it('an error replaces the table, and ADMIN_ONLY re-reads the account', async () => {
    api.admin.actions.mockRejectedValue(notAdmin())
    const { container } = renderPage(<AdminLog />)
    await flush()
    expect(page(container)).toMatchSnapshot()
    expect(auth.refreshUser).toHaveBeenCalledTimes(1)
  })
})

describe('AdminAlerts', () => {
  const closeButtons = () => screen.getAllByRole('button', { name: 'End alert' })

  it('opens on the open alerts, the same in English and Arabic', async () => {
    const { container } = renderPage(<AdminAlerts />)
    await flush()
    expect(api.admin.alerts).toHaveBeenCalledWith({ status: 'open', page: 1, limit: 50 })
    expect(page(container)).toMatchSnapshot()
    cleanup()
    const ar = renderPage(<AdminAlerts />, { lang: 'ar' })
    await flush()
    expect(page(ar.container)).toMatchSnapshot()
  })

  it('All asks for every alert from page 1 and drops an open question', async () => {
    api.admin.alerts.mockResolvedValue({ ...ALERTS, total: 120 })
    const { container } = renderPage(<AdminAlerts />)
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await flush()
    fireEvent.click(closeButtons()[0])
    expect(container.querySelector('[role=alertdialog]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    await flush()
    expect(api.admin.alerts).toHaveBeenLastCalledWith({ status: 'all', page: 1, limit: 50 })
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('[role=alertdialog]')).toBeNull()
  })

  it('asks before ending an alert; cancel goes back', async () => {
    const { container } = renderPage(<AdminAlerts />)
    await flush()
    fireEvent.click(closeButtons()[1])
    expect(html(container.querySelector('tbody'), { outer: true })).toMatchSnapshot()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(container.querySelector('[role=alertdialog]')).toBeNull()
    expect(api.admin.closeAlert).not.toHaveBeenCalled()
  })

  it('ends the alert, says so and reloads the list', async () => {
    let done
    api.admin.closeAlert.mockReturnValue(new Promise((resolve) => { done = resolve }))
    const { container } = renderPage(<AdminAlerts />)
    await flush()
    fireEvent.click(closeButtons()[0])
    fireEvent.click(within(container.querySelector('[role=alertdialog]')).getByRole('button', { name: 'End alert' }))
    await flush()
    expect(api.admin.closeAlert).toHaveBeenCalledWith(12)
    const dialog = container.querySelector('[role=alertdialog]')
    expect([...dialog.querySelectorAll('button')].map((b) => [b.textContent, b.disabled])).toEqual([
      ['Cancel', true], ['Working…', true],
    ])
    await act(async () => done({}))
    expect(screen.getByRole('status').textContent).toBe('Alert ended.')
    expect(api.admin.alerts).toHaveBeenCalledTimes(2)
    expect(container.querySelector('[role=alertdialog]')).toBeNull()
  })

  it('a failed end shows the error above the table; asking again clears it', async () => {
    api.admin.closeAlert.mockRejectedValue(notAdmin())
    const { container } = renderPage(<AdminAlerts />)
    await flush()
    fireEvent.click(closeButtons()[0])
    fireEvent.click(within(container.querySelector('[role=alertdialog]')).getByRole('button', { name: 'End alert' }))
    await flush()
    expect(html(container.querySelector('.form-error'), { outer: true })).toMatchSnapshot()
    expect(container.querySelector('[role=alertdialog]')).not.toBeNull()
    expect(auth.refreshUser).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(container.querySelector('.form-error')).not.toBeNull()
    fireEvent.click(closeButtons()[1])
    expect(container.querySelector('.form-error')).toBeNull()
  })

  it('says why the list is empty, and a failed list shows its error', async () => {
    api.admin.alerts.mockResolvedValue({ total: 0, data: [] })
    const { container } = renderPage(<AdminAlerts />)
    await flush()
    expect(container.querySelector('.table-message').textContent).toBe('No open alerts.')
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    await flush()
    expect(container.querySelector('.table-message').textContent).toBe('No alerts in this period.')
    cleanup()
    api.admin.alerts.mockReturnValue(new Promise(() => {}))
    const loading = renderPage(<AdminAlerts />)
    await flush()
    expect(loading.container.querySelector('.table-message').textContent).toBe('Loading…')
    cleanup()
    api.admin.alerts.mockRejectedValue(apiError('DATABASE_UNAVAILABLE', 'Database is unavailable.', 503))
    const failed = renderPage(<AdminAlerts />)
    await flush()
    expect(html(failed.container.querySelector('.table-card'), { outer: true })).toMatchSnapshot()
  })

  it('reloads every minute', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    renderPage(<AdminAlerts />)
    await flush()
    await act(async () => vi.advanceTimersByTime(59999))
    expect(api.admin.alerts).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTime(1))
    expect(api.admin.alerts).toHaveBeenCalledTimes(2)
  })
})

describe('AdminAlerts question', () => {
  it('names the device in the question, or its id when it has no name', async () => {
    renderPage(<AdminAlerts />)
    await flush()
    fireEvent.click(screen.getAllByRole('button', { name: 'End alert' })[0])
    expect(screen.getByRole('alertdialog').getAttribute('aria-label'))
      .toBe('End the alert of Kitchen now? Do this only if you are sure there is no leak.')
  })
})

describe('PairingCodeBox', () => {
  it('shows the code once and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const onDone = vi.fn()
    const { container } = renderPage(<PairingCodeBox mac="A4:CF:12:3B:9E:01" code="482913" onDone={onDone} />)
    expect(html(container)).toMatchSnapshot()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy code' })))
    expect(writeText).toHaveBeenCalledWith('482913')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('a refused copy does not say Copied', async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderPage(<PairingCodeBox mac="A4:CF:12:3B:9E:01" code="482913" onDone={() => {}} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy code' })))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copied' })))
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy()
  })
})

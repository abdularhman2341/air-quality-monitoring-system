// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, act, fireEvent, within } from '@testing-library/react'
import { renderPage, apiError, html } from './setup'

const ME = { id: 1, name: 'Root', email: 'root@example.com', role: 'admin', email_verified: true, device_count: 0, created_at: '2026-10-01T09:00:00Z' }
const SARA = { id: 7, name: 'Sara', email: 'sara@example.com', role: 'user', email_verified: false, device_count: 2, created_at: '2026-10-05T09:00:00Z' }
const OMAR = { id: 8, name: 'عمر', email: 'omar@example.com', role: 'admin', email_verified: true, device_count: 1, created_at: '2026-11-01T09:00:00Z' }
const auth = vi.hoisted(() => ({ user: null, refreshUser: vi.fn() }))
vi.mock('../../src/auth/AuthContext', () => ({ useAuth: () => auth }))
const api = vi.hoisted(() => ({
  admin: {
    users: vi.fn(), user: vi.fn(), updateUser: vi.fn(), deleteUser: vi.fn(),
    logoutUser: vi.fn(), sendPasswordReset: vi.fn(), verifyUserEmail: vi.fn(),
  },
}))
vi.mock('../../src/api/client', () => ({ api }))
vi.mock('../../src/realtime/socketClient', () => ({ onLiveUpdate: () => () => {} }))
const { default: AdminUsers } = await import('../../src/pages/admin/AdminUsers')

const SARA_DEVICES = { devices: [
  { device_id: 'A4CF123B9E01', name: 'Kitchen', mac_display: 'A4:CF:12:3B:9E:01' },
  { device_id: 'A4CF123B9E7F', name: null, mac_display: 'A4:CF:12:3B:9E:7F' },
] }
const flush = () => act(async () => {})
const manage = (index) => screen.getAllByRole('button', { name: /^(Manage|Close)$/ })[index]
const panel = () => document.querySelector('.admin-panel')
const field = (label) => within(panel()).getByLabelText(label)
const dialog = () => screen.getByRole('alertdialog')
const confirmIn = (name) => within(dialog()).getByRole('button', { name })
async function openUser(index) {
  fireEvent.click(manage(index))
  await flush()
}

beforeEach(() => {
  auth.user = ME
  auth.refreshUser.mockReset().mockResolvedValue(undefined)
  api.admin.users.mockReset().mockResolvedValue({ total: 3, data: [ME, SARA, OMAR] })
  api.admin.user.mockReset().mockResolvedValue(SARA_DEVICES)
  for (const name of ['updateUser', 'deleteUser', 'logoutUser', 'sendPasswordReset', 'verifyUserEmail']) {
    api.admin[name].mockReset().mockResolvedValue({})
  }
})
afterEach(cleanup)

describe('AdminUsers list', () => {
  it('renders the accounts the same in English and Arabic', async () => {
    const { container } = renderPage(<AdminUsers />)
    await flush()
    expect(api.admin.users).toHaveBeenCalledWith({ q: '', page: 1, limit: 50 })
    expect(html(container)).toMatchSnapshot()
    cleanup()
    const ar = renderPage(<AdminUsers />, { lang: 'ar' })
    await flush()
    expect(html(ar.container)).toMatchSnapshot()
  })

  it('a search asks from page 1 with the trimmed text and closes the open panel', async () => {
    api.admin.users.mockResolvedValue({ total: 120, data: [ME, SARA, OMAR] })
    renderPage(<AdminUsers />)
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await flush()
    expect(api.admin.users).toHaveBeenLastCalledWith({ q: '', page: 2, limit: 50 })
    await openUser(1)
    expect(panel()).not.toBeNull()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name or email' }), { target: { value: '  sara ' } })
    await act(async () => fireEvent.submit(screen.getByRole('search')))
    expect(api.admin.users).toHaveBeenLastCalledWith({ q: 'sara', page: 1, limit: 50 })
    expect(panel()).toBeNull()
  })

  it('changing the page closes the open panel', async () => {
    api.admin.users.mockResolvedValue({ total: 120, data: [ME, SARA, OMAR] })
    renderPage(<AdminUsers />)
    await flush()
    await openUser(1)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await flush()
    expect(panel()).toBeNull()
  })

  it('says loading, then no match; a failed list shows its error and ADMIN_ONLY re-reads the account', async () => {
    let answer
    api.admin.users.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    const { container } = renderPage(<AdminUsers />)
    await flush()
    expect(container.querySelector('.table-message').textContent).toBe('Loading…')
    await act(async () => answer({ total: 0, data: [] }))
    expect(container.querySelector('.table-message').textContent).toBe('No accounts match.')
    cleanup()
    api.admin.users.mockRejectedValue(apiError('ADMIN_ONLY', 'Admins only.', 403))
    const failed = renderPage(<AdminUsers />)
    await flush()
    expect(html(failed.container.querySelector('.table-card'), { outer: true })).toMatchSnapshot()
    expect(auth.refreshUser).toHaveBeenCalledTimes(1)
  })
})

describe('AdminUsers panel', () => {
  it('opens one account with its devices; Close closes it', async () => {
    renderPage(<AdminUsers />)
    await flush()
    await openUser(1)
    expect(api.admin.user).toHaveBeenCalledWith(7)
    expect(manage(1).getAttribute('aria-expanded')).toBe('true')
    expect(html(document.querySelector('tbody'), { outer: true })).toMatchSnapshot()
    fireEvent.click(manage(1))
    expect(panel()).toBeNull()
  })

  it('shows loading, no devices, or the error for the device list', async () => {
    let answer
    api.admin.user.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    renderPage(<AdminUsers />)
    await flush()
    await openUser(2)
    expect(panel().querySelector('.admin-subsection').textContent).toBe('Devices of this accountLoading…')
    await act(async () => answer({ devices: [] }))
    expect(panel().querySelector('.admin-subsection').textContent).toBe('Devices of this accountNo devices linked.')
    fireEvent.click(manage(2))
    api.admin.user.mockRejectedValue(apiError('DATABASE_UNAVAILABLE', 'Database is unavailable.', 503))
    await openUser(2)
    expect(panel().querySelector('.admin-subsection').textContent).toBe('Devices of this account')
    expect(within(panel()).getByRole('alert').textContent).toBe('Database is unavailable.')
  })

  it('saving nothing changed says so without a request', async () => {
    renderPage(<AdminUsers />)
    await flush()
    await openUser(1)
    fireEvent.change(field('Email'), { target: { value: ' SARA@example.com ' } })
    expect(panel().querySelector('.field-hint')).toBeNull()
    await act(async () => fireEvent.submit(panel().querySelector('form')))
    expect(screen.getByRole('status').textContent).toBe('Nothing changed.')
    expect(api.admin.updateUser).not.toHaveBeenCalled()
  })

  it('sends only the changed fields as typed, then closes and reloads', async () => {
    renderPage(<AdminUsers />)
    await flush()
    await openUser(1)
    fireEvent.change(field('Name'), { target: { value: 'Sara A ' } })
    fireEvent.change(field('Email'), { target: { value: 'New@Example.com' } })
    expect(within(panel()).getByText(/A new email starts as not verified/)).toBeTruthy()
    fireEvent.change(field('Role'), { target: { value: 'admin' } })
    await act(async () => fireEvent.submit(panel().querySelector('form')))
    expect(api.admin.updateUser).toHaveBeenCalledWith(7, { name: 'Sara A ', email: 'New@Example.com', role: 'admin' })
    expect(auth.refreshUser).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toBe('Account saved.')
    expect(panel()).toBeNull()
    expect(api.admin.users).toHaveBeenCalledTimes(2)
  })

  it('editing yourself re-reads your account, and demoting yourself warns first', async () => {
    renderPage(<AdminUsers />)
    await flush()
    await openUser(0)
    fireEvent.change(field('Role'), { target: { value: 'user' } })
    expect(html(panel().querySelector('form + p'), { outer: true })).toMatchSnapshot()
    await act(async () => fireEvent.submit(panel().querySelector('form')))
    expect(api.admin.updateUser).toHaveBeenCalledWith(1, { role: 'user' })
    expect(auth.refreshUser).toHaveBeenCalledTimes(1)
  })

  it('the save button waits while saving, and a failed save keeps the panel with the error', async () => {
    let fail
    api.admin.updateUser.mockReturnValue(new Promise((_resolve, reject) => { fail = reject }))
    renderPage(<AdminUsers />)
    await flush()
    await openUser(1)
    fireEvent.change(field('Name'), { target: { value: 'Sara A' } })
    await act(async () => fireEvent.submit(panel().querySelector('form')))
    expect(within(panel()).getByRole('button', { name: 'Save' }).disabled).toBe(true)
    await act(async () => fail(apiError('EMAIL_TAKEN', 'Email is already in use.', 409)))
    expect(within(panel()).getByRole('button', { name: 'Save' }).disabled).toBe(false)
    expect(within(panel()).getByRole('alert').textContent).toMatchSnapshot()
    expect(api.admin.users).toHaveBeenCalledTimes(1)
  })
})

describe('AdminUsers actions', () => {
  it('shows mark verified only for an unverified email', async () => {
    renderPage(<AdminUsers />)
    await flush()
    await openUser(1)
    expect(html(panel().querySelector('.admin-danger-actions'), { outer: true })).toMatchSnapshot()
    fireEvent.click(manage(1))
    await openUser(2)
    expect(within(panel()).queryByRole('button', { name: 'Mark email as verified' })).toBeNull()
  })

  const ACTIONS = [
    ['Mark email as verified', 'verifyUserEmail', "Sara's email is now verified."],
    ['Send password reset code', 'sendPasswordReset', 'Reset code sent to Sara.'],
    ['Sign out of all devices', 'logoutUser', 'Sara was signed out of every device.'],
    ['Delete account', 'deleteUser', "Sara's account was deleted."],
  ]
  for (const [label, call, toast] of ACTIONS) {
    it(`${label}: asks, sends, says so, closes and reloads`, async () => {
      renderPage(<AdminUsers />)
      await flush()
      await openUser(1)
      fireEvent.click(within(panel()).getByRole('button', { name: label }))
      expect(html(dialog(), { outer: true })).toMatchSnapshot()
      expect(panel().querySelector('.admin-danger-actions')).toBeNull()
      await act(async () => fireEvent.click(confirmIn(label)))
      expect(api.admin[call]).toHaveBeenCalledWith(7)
      expect(screen.getByRole('status').textContent).toBe(toast)
      expect(panel()).toBeNull()
      expect(api.admin.users).toHaveBeenCalledTimes(2)
      expect(auth.refreshUser).not.toHaveBeenCalled()
    })
  }

  it('on your own account the questions say so, and verifying re-reads your account', async () => {
    auth.user = { ...ME }
    api.admin.users.mockResolvedValue({ total: 1, data: [{ ...ME, email_verified: false }] })
    renderPage(<AdminUsers />)
    await flush()
    await openUser(0)
    for (const label of ['Sign out of all devices', 'Delete account']) {
      fireEvent.click(within(panel()).getByRole('button', { name: label }))
      expect(dialog().getAttribute('aria-label')).toMatchSnapshot()
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    }
    fireEvent.click(within(panel()).getByRole('button', { name: 'Mark email as verified' }))
    await act(async () => fireEvent.click(confirmIn('Mark email as verified')))
    expect(api.admin.verifyUserEmail).toHaveBeenCalledWith(1)
    expect(auth.refreshUser).toHaveBeenCalledTimes(1)
  })

  it('a failed action keeps the question open with the error; buttons wait while it runs', async () => {
    let fail
    api.admin.deleteUser.mockReturnValue(new Promise((_resolve, reject) => { fail = reject }))
    renderPage(<AdminUsers />)
    await flush()
    await openUser(1)
    fireEvent.click(within(panel()).getByRole('button', { name: 'Delete account' }))
    await act(async () => fireEvent.click(confirmIn('Delete account')))
    expect([...dialog().querySelectorAll('button')].map((b) => [b.textContent, b.disabled])).toEqual([
      ['Cancel', true], ['Working…', true],
    ])
    await act(async () => fail(apiError('ADMIN_ONLY', 'Admins only.', 403)))
    expect(dialog()).toBeTruthy()
    expect(within(panel()).getByRole('alert').textContent).toBe('Admins only.')
    expect(auth.refreshUser).toHaveBeenCalledTimes(1)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(panel().querySelector('.admin-danger-actions')).not.toBeNull()
  })
})

// Found by mutation testing during the split.
describe('AdminUsers details pinned before the split', () => {
  it('a search from page 1 asks again', async () => {
    renderPage(<AdminUsers />)
    await flush()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name or email' }), { target: { value: 'omar' } })
    await act(async () => fireEvent.submit(screen.getByRole('search')))
    expect(api.admin.users).toHaveBeenLastCalledWith({ q: 'omar', page: 1, limit: 50 })
  })

  it('spaces around the name alone are not a change', async () => {
    renderPage(<AdminUsers />)
    await flush()
    await openUser(1)
    fireEvent.change(field('Name'), { target: { value: ' Sara ' } })
    await act(async () => fireEvent.submit(panel().querySelector('form')))
    expect(screen.getByRole('status').textContent).toBe('Nothing changed.')
    expect(api.admin.updateUser).not.toHaveBeenCalled()
  })

  it('demoting another admin does not show the self-demotion warning', async () => {
    renderPage(<AdminUsers />)
    await flush()
    await openUser(2)
    fireEvent.change(field('Role'), { target: { value: 'user' } })
    expect(panel().querySelector('form + p')).toBeNull()
  })
})

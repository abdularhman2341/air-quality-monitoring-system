// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, act, fireEvent, within } from '@testing-library/react'
import { renderPage, apiError, html } from './setup'

const auth = vi.hoisted(() => ({ refreshUser: vi.fn() }))
vi.mock('../../src/auth/AuthContext', () => ({ useAuth: () => auth }))
const api = vi.hoisted(() => ({
  admin: {
    devices: vi.fn(), users: vi.fn(), registerDevice: vi.fn(), updateDevice: vi.fn(),
    deleteDevice: vi.fn(), newPairingCode: vi.fn(), readings: vi.fn(),
  },
}))
vi.mock('../../src/api/client', () => ({ api }))
vi.mock('../../src/realtime/socketClient', () => ({ onLiveUpdate: () => () => {} }))
const { default: AdminDevices } = await import('../../src/pages/admin/AdminDevices')

const KITCHEN = {
  device_id: 'A4CF123B9E01', mac_display: 'A4:CF:12:3B:9E:01', name: 'Kitchen', location: 'Floor 1',
  owner: { id: 7, email: 'sara@example.com' }, connection_state: 'online',
  latest: { lpg_ppm_est: 1300, alarm_active: true, reading_time: '2026-11-21T11:59:00Z' },
}
const SPARE = {
  device_id: 'A4CF123B9E7F', mac_display: 'A4:CF:12:3B:9E:7F', name: null, location: null,
  owner: null, connection_state: 'offline', latest: null,
}
const USERS = { data: [{ id: 7, name: 'Sara', email: 'sara@example.com' }, { id: 8, name: 'Omar', email: 'omar@example.com' }] }
const READINGS = { data: [
  { id: 2, reading_time: '2026-11-21T11:59:00Z', lpg_ppm_est: 1300, alarm_active: true },
  { id: 1, reading_time: '2026-11-21T11:58:00Z', lpg_ppm_est: 120, alarm_active: false },
] }
const flush = () => act(async () => {})
const register = () => document.querySelector('.admin-register')
const panel = () => document.querySelector('.admin-panel')
const manage = (index) => screen.getAllByRole('button', { name: /^(Manage|Close)$/ })[index]
const dialog = () => screen.getByRole('alertdialog')
const inPanel = (name) => within(panel()).getByRole('button', { name })
async function openDevice(index) {
  fireEvent.click(manage(index))
  await flush()
}
const savePanel = () => act(async () => fireEvent.submit(panel().querySelector('form')))

beforeEach(() => {
  auth.refreshUser.mockReset()
  api.admin.devices.mockReset().mockResolvedValue({ total: 2, data: [KITCHEN, SPARE] })
  api.admin.users.mockReset().mockResolvedValue(USERS)
  api.admin.registerDevice.mockReset().mockResolvedValue({ device: { mac_display: 'A4:CF:12:3B:9E:99' }, pairing_code: '735104' })
  api.admin.updateDevice.mockReset().mockResolvedValue({})
  api.admin.deleteDevice.mockReset().mockResolvedValue({})
  api.admin.newPairingCode.mockReset().mockResolvedValue({ pairing_code: '111222' })
  api.admin.readings.mockReset().mockResolvedValue(READINGS)
})
afterEach(cleanup)

describe('AdminDevices list', () => {
  it('renders the register form and the devices the same in English and Arabic', async () => {
    const { container } = renderPage(<AdminDevices />)
    await flush()
    expect(api.admin.devices).toHaveBeenCalledWith({ q: '', page: 1, limit: 50 })
    expect(html(container)).toMatchSnapshot()
    cleanup()
    const ar = renderPage(<AdminDevices />, { lang: 'ar' })
    await flush()
    expect(html(ar.container)).toMatchSnapshot()
  })

  it('a search asks from page 1 and closes the panel; so does a new page', async () => {
    api.admin.devices.mockResolvedValue({ total: 120, data: [KITCHEN, SPARE] })
    renderPage(<AdminDevices />)
    await flush()
    await openDevice(0)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await flush()
    expect(api.admin.devices).toHaveBeenLastCalledWith({ q: '', page: 2, limit: 50 })
    expect(panel()).toBeNull()
    await openDevice(0)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: ' kitchen ' } })
    await act(async () => fireEvent.submit(screen.getByRole('search')))
    expect(api.admin.devices).toHaveBeenLastCalledWith({ q: 'kitchen', page: 1, limit: 50 })
    expect(panel()).toBeNull()
  })

  it('a search from page 1 asks again', async () => {
    renderPage(<AdminDevices />)
    await flush()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'omar' } })
    await act(async () => fireEvent.submit(screen.getByRole('search')))
    expect(api.admin.devices).toHaveBeenLastCalledWith({ q: 'omar', page: 1, limit: 50 })
  })

  it('says loading, then no match; a failed list shows its error and ADMIN_ONLY re-reads the account', async () => {
    let answer
    api.admin.devices.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    const { container } = renderPage(<AdminDevices />)
    await flush()
    expect(container.querySelector('.table-message').textContent).toBe('Loading…')
    await act(async () => answer({ total: 0, data: [] }))
    expect(container.querySelector('.table-message').textContent).toBe('No devices match.')
    cleanup()
    api.admin.devices.mockRejectedValue(apiError('ADMIN_ONLY', 'Admins only.', 403))
    const failed = renderPage(<AdminDevices />)
    await flush()
    expect(html(failed.container.querySelector('.table-card'), { outer: true })).toMatchSnapshot()
    expect(auth.refreshUser).toHaveBeenCalledTimes(1)
  })
})

describe('AdminDevices register', () => {
  const regField = (label) => within(register()).getByLabelText(label)
  const regButton = () => within(register()).getByRole('button')

  it('needs a MAC, sends the trimmed fields, shows the code once and reloads', async () => {
    renderPage(<AdminDevices />)
    await flush()
    expect(regButton().disabled).toBe(true)
    fireEvent.change(regField('MAC address'), { target: { value: '   ' } })
    expect(regButton().disabled).toBe(true)
    fireEvent.change(regField('MAC address'), { target: { value: ' a4:cf:12:3b:9e:99 ' } })
    fireEvent.change(regField('Name'), { target: { value: '  ' } })
    fireEvent.change(regField('Location (optional)'), { target: { value: ' Lab ' } })
    await act(async () => fireEvent.submit(register()))
    expect(api.admin.registerDevice).toHaveBeenCalledWith({ mac_address: 'a4:cf:12:3b:9e:99', name: undefined, location: 'Lab' })
    expect(register()).toBeNull()
    expect(html(document.querySelector('.pairing-box'), { outer: true })).toMatchSnapshot()
    expect(api.admin.devices).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(['MAC address', 'Name', 'Location (optional)'].map((l) => regField(l).value)).toEqual(['', '', ''])
  })

  it('sends a trimmed name, and waits while sending', async () => {
    let answer
    api.admin.registerDevice.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    renderPage(<AdminDevices />)
    await flush()
    fireEvent.change(regField('MAC address'), { target: { value: 'A4CF123B9E99' } })
    fireEvent.change(regField('Name'), { target: { value: ' Lab ' } })
    await act(async () => fireEvent.submit(register()))
    expect(api.admin.registerDevice).toHaveBeenCalledWith({ mac_address: 'A4CF123B9E99', name: 'Lab', location: undefined })
    expect([regButton().textContent, regButton().disabled]).toEqual(['Working…', true])
    await act(async () => answer({ device: { mac_display: 'A4:CF:12:3B:9E:99' }, pairing_code: '735104' }))
    expect(document.querySelector('.pairing-code').textContent).toBe('735104')
  })

  const MARKED = [['INVALID_MAC', 'true'], ['DEVICE_EXISTS', 'true'], ['DATABASE_UNAVAILABLE', 'false']]
  for (const [code, marked] of MARKED) {
    it(`a ${code} error shows its text and marks the MAC: ${marked}`, async () => {
      api.admin.registerDevice.mockRejectedValue(apiError(code, `${code} text`))
      renderPage(<AdminDevices />)
      await flush()
      fireEvent.change(regField('MAC address'), { target: { value: 'A4CF123B9E99' } })
      await act(async () => fireEvent.submit(register()))
      expect(regField('MAC address').getAttribute('aria-invalid')).toBe(marked)
      expect(within(register()).getByRole('alert').textContent).toBe(`${code} text`)
      expect([regButton().textContent, regButton().disabled]).toEqual(['Register', false])
      expect(regField('MAC address').value).toBe('A4CF123B9E99')
    })
  }

  it('an ADMIN_ONLY error re-reads the account', async () => {
    api.admin.registerDevice.mockRejectedValue(apiError('ADMIN_ONLY', 'Admins only.', 403))
    renderPage(<AdminDevices />)
    await flush()
    fireEvent.change(regField('MAC address'), { target: { value: 'A4CF123B9E99' } })
    await act(async () => fireEvent.submit(register()))
    expect(auth.refreshUser).toHaveBeenCalledTimes(1)
  })
})

describe('AdminDevices panel', () => {
  const panelField = (label) => within(panel()).getByLabelText(label)

  it('opens with the owner list (first 200 accounts); the select waits for it', async () => {
    let answer
    api.admin.users.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    renderPage(<AdminDevices />)
    await flush()
    await openDevice(0)
    expect(api.admin.users).toHaveBeenCalledWith({ limit: 200 })
    expect(panelField('Owner').disabled).toBe(true)
    await act(async () => answer(USERS))
    expect(manage(0).getAttribute('aria-expanded')).toBe('true')
    expect(html(document.querySelector('tbody'), { outer: true })).toMatchSnapshot()
    fireEvent.click(manage(0))
    expect(panel()).toBeNull()
  })

  it('a failed owner list shows the error in the panel', async () => {
    api.admin.users.mockRejectedValue(apiError('ADMIN_ONLY', 'Admins only.', 403))
    renderPage(<AdminDevices />)
    await flush()
    await openDevice(0)
    expect(within(panel()).getByRole('alert').textContent).toBe('Admins only.')
    expect(auth.refreshUser).toHaveBeenCalledTimes(1)
  })

  it('saving nothing changed says so without a request', async () => {
    renderPage(<AdminDevices />)
    await flush()
    await openDevice(0)
    fireEvent.change(panelField('Name'), { target: { value: ' Kitchen ' } })
    await savePanel()
    expect(screen.getByRole('status').textContent).toBe('Nothing changed.')
    expect(api.admin.updateDevice).not.toHaveBeenCalled()
  })

  it('sends the changed fields trimmed, an emptied one as null, then closes and reloads', async () => {
    renderPage(<AdminDevices />)
    await flush()
    await openDevice(0)
    fireEvent.change(panelField('Name'), { target: { value: ' Big kitchen ' } })
    fireEvent.change(panelField('Location (optional)'), { target: { value: '  ' } })
    await savePanel()
    expect(api.admin.updateDevice).toHaveBeenCalledWith('A4CF123B9E01', { name: 'Big kitchen', location: null })
    expect(screen.getByRole('status').textContent).toBe('Device saved.')
    expect(panel()).toBeNull()
    expect(api.admin.devices).toHaveBeenCalledTimes(2)
  })

  it('the save button waits, and a failed save keeps the panel with the error', async () => {
    let fail
    api.admin.updateDevice.mockReturnValue(new Promise((_resolve, reject) => { fail = reject }))
    renderPage(<AdminDevices />)
    await flush()
    await openDevice(1)
    fireEvent.change(panelField('Name'), { target: { value: 'Spare' } })
    await savePanel()
    expect(inPanel('Save').disabled).toBe(true)
    expect(inPanel('Last readings').disabled).toBe(true)
    await act(async () => fail(apiError('DATABASE_UNAVAILABLE', 'Database is unavailable.', 503)))
    expect(inPanel('Save').disabled).toBe(false)
    expect(within(panel()).getByRole('alert').textContent).toBe('Database is unavailable.')
    expect(api.admin.devices).toHaveBeenCalledTimes(1)
  })

  it('taking a device from its owner asks first and warns about the history', async () => {
    renderPage(<AdminDevices />)
    await flush()
    await openDevice(0)
    fireEvent.change(panelField('Owner'), { target: { value: '8' } })
    expect(html(panel(), { outer: true })).toMatchSnapshot()
    await savePanel()
    expect(api.admin.updateDevice).not.toHaveBeenCalled()
    expect(dialog().getAttribute('aria-label')).toMatchSnapshot()
    expect(panel().querySelector('.admin-danger-actions')).toBeNull()
    await act(async () => fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' })))
    expect(api.admin.updateDevice).toHaveBeenCalledWith('A4CF123B9E01', { owner_id: '8' })
    expect(screen.getByRole('status').textContent).toBe('Device saved.')
  })

  it('removing the owner sends null; saving again while asked goes ahead', async () => {
    renderPage(<AdminDevices />)
    await flush()
    await openDevice(0)
    fireEvent.change(panelField('Owner'), { target: { value: '' } })
    await savePanel()
    expect(dialog()).toBeTruthy()
    await savePanel()
    expect(api.admin.updateDevice).toHaveBeenCalledWith('A4CF123B9E01', { owner_id: null })
  })

  it('giving an unowned device an owner does not ask', async () => {
    renderPage(<AdminDevices />)
    await flush()
    await openDevice(1)
    fireEvent.change(panelField('Owner'), { target: { value: '7' } })
    expect(panel().querySelector('.field-hint')).not.toBeNull()
    await savePanel()
    expect(api.admin.updateDevice).toHaveBeenCalledWith('A4CF123B9E7F', { owner_id: '7' })
  })

  it('a new pairing code asks, replaces the panel until Done, and does not reload', async () => {
    renderPage(<AdminDevices />)
    await flush()
    await openDevice(0)
    fireEvent.click(inPanel('New pairing code'))
    expect(dialog().getAttribute('aria-label')).toBe('Create a new pairing code? The current code will stop working.')
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    fireEvent.click(inPanel('New pairing code'))
    await act(async () => fireEvent.click(within(dialog()).getByRole('button', { name: 'New pairing code' })))
    expect(api.admin.newPairingCode).toHaveBeenCalledWith('A4CF123B9E01')
    expect(panel()).toBeNull()
    expect(html(document.querySelector('.pairing-box'), { outer: true })).toMatchSnapshot()
    expect(document.querySelector('.toast')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(panel()).not.toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(api.admin.devices).toHaveBeenCalledTimes(1)
  })

  it('a failed new code keeps the question with the error', async () => {
    api.admin.newPairingCode.mockRejectedValue(apiError('DATABASE_UNAVAILABLE', 'Database is unavailable.', 503))
    renderPage(<AdminDevices />)
    await flush()
    await openDevice(0)
    fireEvent.click(inPanel('New pairing code'))
    await act(async () => fireEvent.click(within(dialog()).getByRole('button', { name: 'New pairing code' })))
    expect(document.querySelector('.pairing-box')).toBeNull()
    expect(dialog()).toBeTruthy()
    expect(within(panel()).getByRole('alert').textContent).toBe('Database is unavailable.')
  })

  it('shows the last 10 readings in the panel, or says there are none', async () => {
    renderPage(<AdminDevices />)
    await flush()
    await openDevice(0)
    await act(async () => fireEvent.click(inPanel('Last readings')))
    expect(api.admin.readings).toHaveBeenCalledWith('A4CF123B9E01', { limit: 10 })
    expect(html(panel().querySelector('.admin-subsection'), { outer: true })).toMatchSnapshot()
    expect(panel()).not.toBeNull()
    api.admin.readings.mockResolvedValue({ data: [] })
    await act(async () => fireEvent.click(inPanel('Last readings')))
    expect(panel().querySelector('.admin-subsection').textContent).toBe('Last 10 readingsNo readings in this period.')
    expect(api.admin.devices).toHaveBeenCalledTimes(1)
  })

  it('a failed readings request leaves the old list and shows the error', async () => {
    renderPage(<AdminDevices />)
    await flush()
    await openDevice(0)
    await act(async () => fireEvent.click(inPanel('Last readings')))
    api.admin.readings.mockRejectedValue(apiError('DATABASE_UNAVAILABLE', 'Database is unavailable.', 503))
    await act(async () => fireEvent.click(inPanel('Last readings')))
    expect(panel().querySelectorAll('.admin-subsection li').length).toBe(2)
    expect(within(panel()).getByRole('alert').textContent).toBe('Database is unavailable.')
  })

  it('deletes after the question, says so, closes and reloads; the buttons wait', async () => {
    let done
    api.admin.deleteDevice.mockReturnValue(new Promise((resolve) => { done = resolve }))
    renderPage(<AdminDevices />)
    await flush()
    await openDevice(1)
    fireEvent.click(inPanel('Delete device'))
    expect(dialog().getAttribute('aria-label')).toMatchSnapshot()
    await act(async () => fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete device' })))
    expect(api.admin.deleteDevice).toHaveBeenCalledWith('A4CF123B9E7F')
    expect([...dialog().querySelectorAll('button')].map((b) => [b.textContent, b.disabled])).toEqual([
      ['Cancel', true], ['Working…', true],
    ])
    await act(async () => done({}))
    expect(screen.getByRole('status').textContent).toBe('Device deleted.')
    expect(panel()).toBeNull()
    expect(api.admin.devices).toHaveBeenCalledTimes(2)
  })
})

// Found by mutation testing during the split.
describe('AdminDevices details pinned before the split', () => {
  const panelField = (label) => within(panel()).getByLabelText(label)

  it('an emptied name is sent as null', async () => {
    renderPage(<AdminDevices />)
    await flush()
    await openDevice(0)
    fireEvent.change(panelField('Name'), { target: { value: ' ' } })
    await savePanel()
    expect(api.admin.updateDevice).toHaveBeenCalledWith('A4CF123B9E01', { name: null })
  })

  it('edits in the panel survive while a new code is shown', async () => {
    renderPage(<AdminDevices />)
    await flush()
    await openDevice(0)
    fireEvent.change(panelField('Name'), { target: { value: 'Not saved yet' } })
    fireEvent.click(inPanel('New pairing code'))
    await act(async () => fireEvent.click(within(dialog()).getByRole('button', { name: 'New pairing code' })))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(panelField('Name').value).toBe('Not saved yet')
  })
})

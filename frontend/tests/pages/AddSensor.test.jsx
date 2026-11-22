// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, act, fireEvent, within } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { renderPage, apiError, html } from './setup'

const api = vi.hoisted(() => ({ listDevices: vi.fn(), linkDevice: vi.fn(), unlinkDevice: vi.fn() }))
vi.mock('../../src/api/client', () => ({ api }))
const { default: AddSensor } = await import('../../src/pages/sensors/AddSensor')

const KITCHEN = { device_id: 'A4CF123B9E01', mac_display: 'A4:CF:12:3B:9E:01', name: 'Kitchen' }
const GARAGE = { device_id: 'A4CF123B9E7F', mac_display: 'A4:CF:12:3B:9E:7F', name: 'Garage' }
const flush = () => act(async () => {})

// The dashboard stand-in shows where AddSensor sent the user and with what.
function Landing() {
  const location = useLocation()
  return <p data-testid="landing">{JSON.stringify(location.state)}</p>
}
function renderAddSensor(options = {}) {
  return renderPage(
    <Routes>
      <Route path="/add-sensor" element={<AddSensor />} />
      <Route path="/" element={<Landing />} />
    </Routes>,
    { route: '/add-sensor', ...options },
  )
}
const form = () => screen.getByRole('button', { name: /Add Sensor|Adding…/ }).closest('form')
const input = (label) => within(form()).getByLabelText(label)
function fill(values) {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(input(label), { target: { value } })
  }
}
const submit = () => act(async () => fireEvent.submit(form()))
const sensors = () => document.querySelector('.my-sensors')

beforeEach(() => {
  api.listDevices.mockReset().mockResolvedValue([KITCHEN, GARAGE])
  api.linkDevice.mockReset().mockResolvedValue({ device_id: 'A4CF123B9E99' })
  api.unlinkDevice.mockReset().mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('AddSensor form', () => {
  it('renders the same page in English and Arabic', async () => {
    const { container } = renderAddSensor()
    await flush()
    expect(html(container)).toMatchSnapshot()
    cleanup()
    const ar = renderAddSensor({ lang: 'ar' })
    await flush()
    expect(html(ar.container)).toMatchSnapshot()
  })

  it('checks the MAC, then the code, then the name, without sending', async () => {
    renderAddSensor()
    await flush()
    await submit()
    expect(screen.getByRole('alert').textContent).toBe('Enter a valid MAC address, e.g. A4:CF:12:3B:9E:01.')
    expect(input('MAC address').getAttribute('aria-invalid')).toBe('true')
    fill({ 'MAC address': 'a4-cf-12-3b-9e-01' })
    await submit()
    expect(screen.getByRole('alert').textContent).toBe('Enter the pairing code from the label.')
    expect(input('MAC address').getAttribute('aria-invalid')).toBe('false')
    fill({ 'Pairing code': '   ' })
    await submit()
    expect(screen.getByRole('alert').textContent).toBe('Enter the pairing code from the label.')
    fill({ 'Pairing code': '482913', Name: '  ' })
    await submit()
    expect(screen.getByRole('alert').textContent).toBe('Give the sensor a name.')
    fill({ 'MAC address': 'A4:CF:12:3B:9E:0' })
    await submit()
    expect(screen.getByRole('alert').textContent).toBe('Enter a valid MAC address, e.g. A4:CF:12:3B:9E:01.')
    expect(api.linkDevice).not.toHaveBeenCalled()
  })

  it('sends the trimmed values, says so and opens the dashboard on the new device', async () => {
    renderAddSensor()
    await flush()
    fill({ 'MAC address': ' a4:cf:12:3b:9e:99 ', 'Pairing code': ' 482913 ', Name: ' Lab ', 'Location (optional)': '   ' })
    await submit()
    expect(api.linkDevice).toHaveBeenCalledWith({
      mac_address: 'a4:cf:12:3b:9e:99', pairing_code: '482913', name: 'Lab', location: undefined,
    })
    expect(screen.getByRole('status').textContent).toBe('Sensor added')
    expect(screen.getByTestId('landing').textContent).toBe('{"selected":"A4CF123B9E99"}')
  })

  it('sends a trimmed location, and the button waits while sending', async () => {
    let answer
    api.linkDevice.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    renderAddSensor()
    await flush()
    fill({ 'MAC address': 'A4CF123B9E99', 'Pairing code': '482913', Name: 'Lab', 'Location (optional)': ' Floor 2 ' })
    await submit()
    expect(api.linkDevice).toHaveBeenCalledWith(expect.objectContaining({ location: 'Floor 2' }))
    const button = screen.getByRole('button', { name: 'Adding…' })
    expect(button.disabled).toBe(true)
    await act(async () => answer({ device_id: 'A4CF123B9E99' }))
    expect(screen.getByTestId('landing')).toBeTruthy()
  })

  it('a server error shows its text; only INVALID_MAC marks the MAC field', async () => {
    api.linkDevice.mockRejectedValue(apiError('INVALID_MAC', 'mac_address must be 12 hex characters.'))
    renderAddSensor()
    await flush()
    fill({ 'MAC address': 'A4CF123B9E99', 'Pairing code': '482913', Name: 'Lab' })
    await submit()
    expect(input('MAC address').getAttribute('aria-invalid')).toBe('true')
    expect(within(form()).getByRole('alert').textContent).toMatchSnapshot()
    api.linkDevice.mockRejectedValue(apiError('DEVICE_ALREADY_LINKED', 'Device is already linked to another account.', 409))
    await submit()
    expect(input('MAC address').getAttribute('aria-invalid')).toBe('false')
    expect(within(form()).getByRole('alert').textContent).toMatchSnapshot()
    expect(screen.getByRole('button', { name: 'Add Sensor' }).disabled).toBe(false)
  })
})

describe('AddSensor my sensors', () => {
  it('shows loading, then the list; an empty list and a failed list say so', async () => {
    let answer
    api.listDevices.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    renderAddSensor()
    expect(sensors().textContent).toBe('My sensorsLoading…')
    await act(async () => answer([]))
    expect(sensors().textContent).toBe('My sensorsNo sensors linked yet.')
    cleanup()
    api.listDevices.mockRejectedValue(apiError('DATABASE_UNAVAILABLE', 'Database is unavailable.', 503))
    renderAddSensor()
    await flush()
    expect(html(sensors(), { outer: true })).toMatchSnapshot()
  })

  it('asks before removing, and cancel goes back', async () => {
    renderAddSensor()
    await flush()
    const rows = sensors().querySelectorAll('.sensor-row')
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Remove' }))
    expect(html(sensors(), { outer: true })).toMatchSnapshot()
    fireEvent.click(within(sensors()).getByRole('button', { name: 'Cancel' }))
    expect(sensors().querySelector('.sensor-confirm')).toBeNull()
    expect(api.unlinkDevice).not.toHaveBeenCalled()
  })

  it('removes after the second click, says so and loads the list again', async () => {
    let done
    api.unlinkDevice.mockReturnValue(new Promise((resolve) => { done = resolve }))
    renderAddSensor()
    await flush()
    fireEvent.click(within(sensors().querySelectorAll('.sensor-row')[1]).getByRole('button', { name: 'Remove' }))
    fireEvent.click(within(sensors().querySelector('.sensor-confirm')).getByRole('button', { name: 'Remove' }))
    await flush()
    expect(api.unlinkDevice).toHaveBeenCalledWith('A4CF123B9E7F')
    const confirm = sensors().querySelector('.sensor-confirm')
    expect([...confirm.querySelectorAll('button')].map((b) => [b.textContent, b.disabled])).toEqual([
      ['Cancel', true], ['Removing…', true],
    ])
    api.listDevices.mockResolvedValue([KITCHEN])
    await act(async () => done())
    expect(screen.getByRole('status').textContent).toBe('“Garage” removed')
    expect(api.listDevices).toHaveBeenCalledTimes(2)
    expect(sensors().querySelectorAll('.sensor-row').length).toBe(1)
    expect(sensors().querySelector('.sensor-confirm')).toBeNull()
  })

  it('a failed remove keeps the question open with the error; asking again clears it', async () => {
    api.unlinkDevice.mockRejectedValue(apiError('DEVICE_NOT_FOUND', 'Device not found.', 404))
    renderAddSensor()
    await flush()
    fireEvent.click(within(sensors().querySelectorAll('.sensor-row')[0]).getByRole('button', { name: 'Remove' }))
    fireEvent.click(within(sensors().querySelector('.sensor-confirm')).getByRole('button', { name: 'Remove' }))
    await flush()
    expect(within(sensors()).getByRole('alert').textContent).toMatchSnapshot()
    expect(sensors().querySelector('.sensor-confirm')).not.toBeNull()
    expect(within(sensors().querySelector('.sensor-confirm')).getByRole('button', { name: 'Remove' }).disabled).toBe(false)
    fireEvent.click(within(sensors()).getByRole('button', { name: 'Cancel' }))
    expect(within(sensors()).queryByRole('alert')).not.toBeNull()
    fireEvent.click(within(sensors().querySelectorAll('.sensor-row')[1]).getByRole('button', { name: 'Remove' }))
    expect(within(sensors()).queryByRole('alert')).toBeNull()
    expect(api.listDevices).toHaveBeenCalledTimes(1)
  })
})

// Found by mutation testing during the split.
describe('AddSensor details pinned before the split', () => {
  it('a MAC with more than 12 hex digits is refused too', async () => {
    renderAddSensor()
    await flush()
    fill({ 'MAC address': 'A4CF123B9E01F', 'Pairing code': '482913', Name: 'Lab' })
    await submit()
    expect(screen.getByRole('alert').textContent).toBe('Enter a valid MAC address, e.g. A4:CF:12:3B:9E:01.')
    expect(api.linkDevice).not.toHaveBeenCalled()
  })

  it('a finished remove closes the question even if the device is still listed', async () => {
    renderAddSensor()
    await flush()
    fireEvent.click(within(sensors().querySelectorAll('.sensor-row')[0]).getByRole('button', { name: 'Remove' }))
    fireEvent.click(within(sensors().querySelector('.sensor-confirm')).getByRole('button', { name: 'Remove' }))
    await flush()
    expect(sensors().querySelectorAll('.sensor-row').length).toBe(2)
    expect(sensors().querySelector('.sensor-confirm')).toBeNull()
  })
})

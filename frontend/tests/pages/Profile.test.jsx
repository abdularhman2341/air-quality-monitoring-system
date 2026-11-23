// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderPage, apiError, html } from './setup'
import Profile from '../../src/pages/profile/Profile'

const auth = vi.hoisted(() => ({ current: null }))
vi.mock('../../src/auth/AuthContext', () => ({ useAuth: () => auth.current }))
vi.mock('../../src/api/client', () => ({ api: { resendEmailChange: vi.fn() } }))

function fakeAuth(user = {}) {
  return {
    user: {
      name: 'Sara',
      email: 'sara@example.com',
      created_at: '2026-10-01T09:00:00.000Z',
      alert_emails: true,
      pending_email: null,
      ...user,
    },
    updateProfile: vi.fn().mockResolvedValue({}),
    changeEmail: vi.fn().mockResolvedValue({}),
    confirmEmailChange: vi.fn().mockResolvedValue({}),
    cancelEmailChange: vi.fn().mockResolvedValue({}),
    changePassword: vi.fn().mockResolvedValue({}),
    logoutAll: vi.fn().mockResolvedValue({}),
    deleteAccount: vi.fn().mockResolvedValue({}),
    logout: vi.fn(),
  }
}

const section = (title) => screen.getByRole('heading', { name: title }).parentElement

beforeEach(() => {
  auth.current = fakeAuth()
})
afterEach(cleanup)

describe('Profile page', () => {
  it('renders the same markup in English', () => {
    const { container } = renderPage(<Profile />)
    expect(html(container)).toMatchSnapshot()
  })

  it('renders the same markup in Arabic', () => {
    const { container } = renderPage(<Profile />, { lang: 'ar' })
    expect(html(container)).toMatchSnapshot()
  })

  it('saves a new name and shows a toast', async () => {
    const user = userEvent.setup()
    renderPage(<Profile />)
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save.disabled).toBe(true)
    const name = screen.getByDisplayValue('Sara')
    await user.clear(name)
    await user.type(name, '  Nora ')
    await user.click(save)
    expect(auth.current.updateProfile).toHaveBeenCalledWith({ name: 'Nora' })
    expect(await screen.findByText('Saved.')).toBeTruthy()
  })

  it('shows the server error when the name cannot be saved', async () => {
    auth.current.updateProfile.mockRejectedValue(apiError('VALIDATION_ERROR', 'Name is too long'))
    const user = userEvent.setup()
    renderPage(<Profile />)
    await user.type(screen.getByDisplayValue('Sara'), 'h')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Name is too long')
    expect(screen.getByRole('button', { name: 'Save' }).disabled).toBe(false)
  })

  it('signs out from the logout button', async () => {
    const user = userEvent.setup()
    renderPage(<Profile />)
    await user.click(screen.getByRole('button', { name: 'Log Out' }))
    expect(auth.current.logout).toHaveBeenCalled()
  })

  it('refuses the current email without asking the server', async () => {
    const user = userEvent.setup()
    const { container } = renderPage(<Profile />)
    await user.click(screen.getByRole('button', { name: 'Change' }))
    expect(html(container.querySelector('.profile-subform'), { outer: true })).toMatchSnapshot()
    await user.type(screen.getByLabelText('New email'), ' SARA@example.com')
    await user.type(screen.getAllByLabelText('Current password')[0], 'secret123')
    await user.click(screen.getByRole('button', { name: 'Save email' }))
    expect(screen.getByRole('alert').textContent).toBe('This is already your email.')
    expect(auth.current.changeEmail).not.toHaveBeenCalled()
  })

  it('sends the code for a new email and closes the form', async () => {
    const user = userEvent.setup()
    renderPage(<Profile />)
    await user.click(screen.getByRole('button', { name: 'Change' }))
    await user.type(screen.getByLabelText('New email'), 'new@example.com ')
    await user.type(screen.getAllByLabelText('Current password')[0], 'secret123')
    await user.click(screen.getByRole('button', { name: 'Save email' }))
    expect(auth.current.changeEmail).toHaveBeenCalledWith('new@example.com', 'secret123')
    expect(await screen.findByText('We sent a code to the new email.')).toBeTruthy()
    expect(screen.queryByLabelText('New email')).toBeNull()
  })

  it('cancel closes the email form without a request', async () => {
    const user = userEvent.setup()
    renderPage(<Profile />)
    await user.click(screen.getByRole('button', { name: 'Change' }))
    await user.click(screen.getAllByRole('button', { name: 'Cancel' })[0])
    expect(screen.queryByLabelText('New email')).toBeNull()
    expect(screen.getByRole('button', { name: 'Change' })).toBeTruthy()
  })

  it('shows a pending email with its code form, and can cancel it', async () => {
    auth.current = fakeAuth({ pending_email: 'new@example.com' })
    const user = userEvent.setup()
    const { container } = renderPage(<Profile />)
    expect(html(container.querySelector('.pending-email'), { outer: true })).toMatchSnapshot()
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull()
    await user.click(container.querySelector('.pending-email-cancel'))
    expect(auth.current.cancelEmailChange).toHaveBeenCalled()
    expect(await screen.findByText('Email change cancelled.')).toBeTruthy()
  })

  it('confirms a pending email with the 6-digit code', async () => {
    auth.current = fakeAuth({ pending_email: 'new@example.com' })
    const user = userEvent.setup()
    const { container } = renderPage(<Profile />)
    await user.type(container.querySelector('#change-email-code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Confirm email' }))
    expect(auth.current.confirmEmailChange).toHaveBeenCalledWith('123456')
  })

  it('shows the error when cancelling a pending email fails', async () => {
    auth.current = fakeAuth({ pending_email: 'new@example.com' })
    auth.current.cancelEmailChange.mockRejectedValue(apiError('UNKNOWN_ERROR', 'Try again'))
    const user = userEvent.setup()
    const { container } = renderPage(<Profile />)
    await user.click(container.querySelector('.pending-email-cancel'))
    expect((await screen.findByRole('alert')).textContent).toBe('Try again')
  })

  it('turns gas alert emails off at once', async () => {
    const user = userEvent.setup()
    renderPage(<Profile />)
    await user.click(screen.getByRole('switch'))
    expect(auth.current.updateProfile).toHaveBeenCalledWith({ alert_emails: false })
    expect(await screen.findByText('Gas alert emails are off.')).toBeTruthy()
  })

  it('hides the alert email switch when the server sends no setting', () => {
    auth.current = fakeAuth({ alert_emails: undefined })
    renderPage(<Profile />)
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('checks the new password before sending it', async () => {
    const user = userEvent.setup()
    const { container } = renderPage(<Profile />)
    await user.click(screen.getByRole('button', { name: 'Change password…' }))
    expect(html(section('Password'), { outer: true })).toMatchSnapshot()
    const form = container.querySelectorAll('.profile-subform')[0]
    const [current, next, confirm] = form.querySelectorAll('input')
    await user.type(current, 'old-pass-1')
    await user.type(next, 'new-pass-1')
    await user.type(confirm, 'new-pass-2')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByRole('alert').textContent).toBe('Passwords do not match.')
    expect(confirm.getAttribute('aria-invalid')).toBe('true')
    expect(auth.current.changePassword).not.toHaveBeenCalled()
    await user.type(confirm, 'x')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('changes the password, closes the form and shows a toast', async () => {
    const user = userEvent.setup()
    const { container } = renderPage(<Profile />)
    await user.click(screen.getByRole('button', { name: 'Change password…' }))
    const [current, next, confirm] = container.querySelectorAll('.profile-subform')[0].querySelectorAll('input')
    await user.type(current, 'old-pass-1')
    await user.type(next, 'new-pass-1')
    await user.type(confirm, 'new-pass-1')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(auth.current.changePassword).toHaveBeenCalledWith('old-pass-1', 'new-pass-1')
    expect(await screen.findByText('Password changed. Other devices were signed out.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Change password…' })).toBeTruthy()
  })

  it('keeps the password form open with the server error', async () => {
    auth.current.changePassword.mockRejectedValue(apiError('WRONG_PASSWORD', 'Wrong password', 403))
    const user = userEvent.setup()
    const { container } = renderPage(<Profile />)
    await user.click(screen.getByRole('button', { name: 'Change password…' }))
    const [current, next, confirm] = container.querySelectorAll('.profile-subform')[0].querySelectorAll('input')
    await user.type(current, 'bad')
    await user.type(next, 'new-pass-1')
    await user.type(confirm, 'new-pass-1')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Wrong password')
    expect(screen.getByRole('button', { name: 'Change password' }).disabled).toBe(false)
  })

  it('signs out other devices with the password', async () => {
    const user = userEvent.setup()
    renderPage(<Profile />)
    await user.click(screen.getByRole('button', { name: 'Sign out of all devices…' }))
    expect(html(section('Sign out of all devices'), { outer: true })).toMatchSnapshot()
    await user.type(section('Sign out of all devices').querySelector('input'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign out everywhere' }))
    expect(auth.current.logoutAll).toHaveBeenCalledWith('secret123')
    expect(await screen.findByText('Signed out of all other devices.')).toBeTruthy()
  })

  it('keeps the delete button disabled after the account is deleted', async () => {
    const user = userEvent.setup()
    const { container } = renderPage(<Profile />)
    await user.click(screen.getByRole('button', { name: 'Delete account…' }))
    await user.type(container.querySelector('.danger-zone input'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }))
    const button = container.querySelector('.danger-zone button[type=submit]')
    expect(button.disabled).toBe(true)
    expect(button.textContent).toBe('Deleting…')
  })

  it('cancel frees the password form even while its request runs', async () => {
    auth.current.changePassword.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    const { container } = renderPage(<Profile />)
    await user.click(screen.getByRole('button', { name: 'Change password…' }))
    const [current, next, confirm] = container.querySelectorAll('.profile-subform')[0].querySelectorAll('input')
    await user.type(current, 'old-pass-1')
    await user.type(next, 'new-pass-1')
    await user.type(confirm, 'new-pass-1')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    await user.click(screen.getAllByRole('button', { name: 'Cancel' })[0])
    await user.click(screen.getByRole('button', { name: 'Change password…' }))
    expect(screen.queryByText('Saving…')).toBeNull()
  })

  it('deletes the account after the password, and shows an error on failure', async () => {
    auth.current.deleteAccount.mockRejectedValue(apiError('WRONG_PASSWORD', 'Wrong password', 403))
    const user = userEvent.setup()
    const { container } = renderPage(<Profile />)
    await user.click(screen.getByRole('button', { name: 'Delete account…' }))
    expect(html(container.querySelector('.danger-zone'), { outer: true })).toMatchSnapshot()
    await user.type(container.querySelector('.danger-zone input'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }))
    expect(auth.current.deleteAccount).toHaveBeenCalledWith('secret123')
    expect((await screen.findByRole('alert')).textContent).toBe('Wrong password')
    expect(screen.getByRole('button', { name: 'Delete permanently' }).disabled).toBe(false)
  })
})

// C3: the current-password fields of the email and delete forms stopped at 72
// characters and cut the rest without a word, while the backend counts 72
// bytes. Like sign-in, they now send what was typed and the server answers.
describe('current password is sent as typed (C3)', () => {
  const LONG = 'p'.repeat(80)

  it('the email form sends a password longer than 72 characters whole', async () => {
    const user = userEvent.setup()
    renderPage(<Profile />)
    await user.click(screen.getByRole('button', { name: 'Change' }))
    await user.type(screen.getByLabelText('New email'), 'new@example.com')
    await user.type(screen.getAllByLabelText('Current password')[0], LONG)
    await user.click(screen.getByRole('button', { name: 'Save email' }))
    expect(auth.current.changeEmail).toHaveBeenCalledWith('new@example.com', LONG)
  })

  it('the delete form does the same', async () => {
    const user = userEvent.setup()
    const { container } = renderPage(<Profile />)
    await user.click(screen.getByRole('button', { name: 'Delete account…' }))
    await user.type(container.querySelector('.danger-zone input'), LONG)
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }))
    expect(auth.current.deleteAccount).toHaveBeenCalledWith(LONG)
  })
})


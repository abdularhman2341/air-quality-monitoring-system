// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router-dom'
import { renderPage, apiError, html } from './setup'
import Login from '../../src/pages/Login'
import Signup from '../../src/pages/Signup'
import ForgotPassword from '../../src/pages/forgot/ForgotPassword'
import AuthLayout from '../../src/components/AuthLayout'

const auth = vi.hoisted(() => ({ current: null }))
const api = vi.hoisted(() => ({ forgotPassword: vi.fn(), resetPassword: vi.fn(), resendSignupCode: vi.fn() }))
vi.mock('../../src/auth/AuthContext', () => ({ useAuth: () => auth.current }))
vi.mock('../../src/api/client', () => ({ api }))

function LoginProbe() {
  const location = useLocation()
  return <p data-testid="probe">{JSON.stringify(location.state)}</p>
}

beforeEach(() => {
  auth.current = {
    login: vi.fn().mockResolvedValue({}),
    register: vi.fn().mockResolvedValue({ email: 'sara@example.com' }),
    activate: vi.fn().mockResolvedValue({}),
  }
  api.forgotPassword.mockReset().mockResolvedValue({})
  api.resetPassword.mockReset().mockResolvedValue({})
  api.resendSignupCode.mockReset().mockResolvedValue({})
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('AuthLayout', () => {
  it('renders the same markup in both languages', () => {
    expect(html(renderPage(<AuthLayout><p>form</p></AuthLayout>).container)).toMatchSnapshot()
    cleanup()
    expect(html(renderPage(<AuthLayout><p>form</p></AuthLayout>, { lang: 'ar' }).container)).toMatchSnapshot()
  })
})

describe('Login', () => {
  it('renders the same markup, with the reset notice and email from the reset page', () => {
    const route = { pathname: '/login', state: { passwordReset: true, email: 'sara@example.com' } }
    expect(html(renderPage(<Login />, { route }).container)).toMatchSnapshot()
  })

  it('signs in and keeps the button busy while the page leaves', async () => {
    const user = userEvent.setup()
    renderPage(<Login />)
    await user.type(screen.getByLabelText('Email'), 'sara@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(auth.current.login).toHaveBeenCalledWith('sara@example.com', 'secret123')
    expect(screen.getByRole('button', { name: 'Signing in…' }).disabled).toBe(true)
  })

  it('shows the server error and frees the button', async () => {
    auth.current.login.mockRejectedValue(apiError('INVALID_CREDENTIALS', 'Wrong email or password', 401))
    const user = userEvent.setup()
    renderPage(<Login />, { lang: 'ar' })
    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'sara@example.com')
    await user.type(screen.getByLabelText('كلمة المرور'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'دخول' }))
    expect(html(await screen.findByRole('alert'), { outer: true })).toMatchSnapshot()
  })

  it('an account that was never activated goes to the code step, and Back returns', async () => {
    auth.current.login.mockRejectedValue(apiError('EMAIL_NOT_VERIFIED', 'Not verified', 403))
    const user = userEvent.setup()
    const { container } = renderPage(<Login />)
    await user.type(screen.getByLabelText('Email'), 'sara@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(html(container)).toMatchSnapshot()
    await user.type(container.querySelector('#activate-code'), '12a3456')
    await user.click(screen.getByRole('button', { name: 'Activate' }))
    expect(auth.current.activate).toHaveBeenCalledWith('sara@example.com', '123456')
    expect(screen.getByRole('button', { name: 'Activate' }).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByLabelText('Email').value).toBe('sara@example.com')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('Signup', () => {
  async function fill(user, password, confirm) {
    await user.type(screen.getByLabelText('Name'), 'Sara')
    await user.type(screen.getByLabelText('Email'), 'sara@example.com')
    await user.type(screen.getByLabelText(/^Password/), password)
    await user.type(screen.getByLabelText('Confirm password'), confirm)
    await user.click(screen.getByRole('button', { name: 'Sign up' }))
  }

  it('renders the same markup', () => {
    expect(html(renderPage(<Signup />).container)).toMatchSnapshot()
  })

  it('checks a short password without a request, and typing clears the message', async () => {
    const user = userEvent.setup()
    const { container } = renderPage(<Signup />)
    await fill(user, 'short', 'short')
    expect(html(container.querySelector('form'), { outer: true })).toMatchSnapshot()
    expect(auth.current.register).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText(/^Password/), 'x')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('checks that the two passwords match', async () => {
    const user = userEvent.setup()
    renderPage(<Signup />)
    await fill(user, 'password-1', 'password-2')
    expect(screen.getByRole('alert').textContent).toBe('Passwords do not match.')
    expect(screen.getByLabelText('Confirm password').getAttribute('aria-describedby')).toBe('password-error')
  })

  it('registers and shows the code step for the email the server used', async () => {
    const user = userEvent.setup()
    renderPage(<Signup />)
    await fill(user, 'password-1', 'password-1')
    expect(auth.current.register).toHaveBeenCalledWith('Sara', 'sara@example.com', 'password-1')
    expect(await screen.findByRole('heading', { name: 'Activate your account' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByLabelText('Name').value).toBe('Sara')
  })

  it('shows the server error and frees the button', async () => {
    auth.current.register.mockRejectedValue(apiError('EMAIL_TAKEN', 'Email taken', 409))
    const user = userEvent.setup()
    renderPage(<Signup />)
    await fill(user, 'password-1', 'password-1')
    expect((await screen.findByRole('alert')).textContent).toBe('Email taken')
    expect(screen.getByRole('button', { name: 'Sign up' }).disabled).toBe(false)
  })
})

describe('ForgotPassword', () => {
  function renderForgot() {
    return renderPage(
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/login" element={<LoginProbe />} />
      </Routes>,
      { route: '/forgot-password' },
    )
  }

  async function askForCode(user) {
    await user.type(screen.getByLabelText('Email'), ' sara@example.com ')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
  }

  it('renders the email step the same', () => {
    expect(html(renderForgot().container)).toMatchSnapshot()
  })

  it('asks for a code with the trimmed email, then shows the code step and the wait', async () => {
    const user = userEvent.setup()
    const { container } = renderForgot()
    await askForCode(user)
    expect(api.forgotPassword).toHaveBeenCalledWith('sara@example.com')
    expect(html(container)).toMatchSnapshot()
  })

  it('keeps the email step with the error when sending fails', async () => {
    api.forgotPassword.mockRejectedValue(apiError('TOO_MANY_ATTEMPTS', 'Slow down', 429))
    const user = userEvent.setup()
    renderForgot()
    await askForCode(user)
    expect((await screen.findByRole('alert')).textContent).toBe('Slow down')
    expect(screen.getByRole('button', { name: 'Send code' }).disabled).toBe(false)
  })

  it('resets the password and goes to sign in with a notice', async () => {
    const user = userEvent.setup()
    renderForgot()
    await askForCode(user)
    const save = screen.getByRole('button', { name: 'Change password' })
    await user.type(screen.getByLabelText(/^Code/), '12-34-56')
    expect(save.disabled).toBe(false)
    await user.type(screen.getByLabelText(/^New password/), 'password-1')
    await user.type(screen.getByLabelText('Confirm password'), 'password-1')
    await user.click(save)
    expect(api.resetPassword).toHaveBeenCalledWith('sara@example.com', '123456', 'password-1')
    expect(JSON.parse(screen.getByTestId('probe').textContent)).toEqual({ passwordReset: true, email: 'sara@example.com' })
  })

  it('checks the new password locally, and shows a wrong code from the server', async () => {
    api.resetPassword.mockRejectedValue(apiError('INVALID_CODE', 'Wrong code'))
    const user = userEvent.setup()
    renderForgot()
    await askForCode(user)
    await user.type(screen.getByLabelText(/^Code/), '123456')
    await user.type(screen.getByLabelText(/^New password/), 'short')
    await user.type(screen.getByLabelText('Confirm password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByRole('alert').textContent).toBe('Password must be at least 8 characters.')
    expect(api.resetPassword).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText(/^New password/), '-long-enough')
    await user.type(screen.getByLabelText('Confirm password'), '-long-enough')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Wrong code')
    expect(screen.getByRole('button', { name: 'Change password' }).disabled).toBe(false)
  })

  it('counts down, then sends a new code', async () => {
    vi.useFakeTimers()
    renderForgot()
    const tick = () => act(async () => { vi.advanceTimersByTime(1000) })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sara@example.com' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send code' })) })
    expect(screen.getByText('New code in 60s')).toBeTruthy()
    await tick()
    expect(screen.getByText('New code in 59s')).toBeTruthy()
    for (let i = 0; i < 58; i += 1) await tick()
    expect(screen.getByText('New code in 1s')).toBeTruthy()
    await tick()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send a new code' })) })
    expect(api.forgotPassword).toHaveBeenCalledTimes(2)
    expect(screen.getByText('New code in 60s')).toBeTruthy()
  })

  it('another email starts over and clears the code step', async () => {
    const user = userEvent.setup()
    renderForgot()
    await askForCode(user)
    await user.type(screen.getByLabelText(/^Code/), '123456')
    await user.click(screen.getByRole('button', { name: 'Use another email' }))
    expect(screen.getByLabelText('Email').value).toBe('sara@example.com')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    expect(screen.getByLabelText(/^Code/).value).toBe('')
  })
})

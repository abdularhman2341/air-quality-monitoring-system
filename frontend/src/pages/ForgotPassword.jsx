import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../i18n/LanguageContext'
import { passwordErrorKey } from '../utils/password'

const RESEND_SECONDS = 60

// Two steps on one page: ask for the code, then type it with the new
// password. The server gives the same answer whether or not the email has an
// account, so this page never says "no such account".
function ForgotPassword() {
  const { t, errorText } = useLanguage()
  const navigate = useNavigate()
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordError, setPasswordError] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  async function sendCode(e) {
    e?.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api.forgotPassword(email.trim())
      setStep('code')
      setWait(RESEND_SECONDS)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword(e) {
    e.preventDefault()
    setError(null)
    const key = passwordErrorKey(password, confirm)
    if (key) {
      setPasswordError(key)
      return
    }
    setBusy(true)
    try {
      await api.resetPassword(email.trim(), code, password)
      navigate('/login', { replace: true, state: { passwordReset: true, email: email.trim() } })
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  function startOver() {
    setStep('email')
    setCode('')
    setPassword('')
    setConfirm('')
    setPasswordError(null)
    setError(null)
  }

  if (step === 'email') {
    return (
      <>
        <h2>{t('forgot.title')}</h2>
        <p className="subtitle">{t('forgot.subtitle')}</p>
        <form className="form" onSubmit={sendCode}>
          <label className="field">
            {t('login.email')}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              dir="ltr"
              required
              autoFocus
            />
          </label>
          {error && <p className="form-error" role="alert">{errorText(error)}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? t('forgot.sending') : t('forgot.send')}
          </button>
        </form>
        <p className="auth-switch">
          <Link to="/login">{t('forgot.backToLogin')}</Link>
        </p>
      </>
    )
  }

  const passwordInvalid = passwordError === 'signup.passwordTooShort' || passwordError === 'signup.passwordTooLong'

  return (
    <>
      <h2>{t('forgot.codeTitle')}</h2>
      <p className="subtitle">
        {t('forgot.codeSubtitle')} <bdi className="auth-email" dir="ltr">{email.trim()}</bdi>
      </p>
      <form className="form" onSubmit={resetPassword}>
        <label className="field">
          {t('forgot.code')}
          <input
            className="code-input"
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete="one-time-code"
            dir="ltr"
            placeholder="000000"
            aria-describedby="code-hint"
            required
            autoFocus
          />
          <span className="field-hint" id="code-hint">{t('forgot.codeHint')}</span>
        </label>
        <label className="field">
          {t('forgot.newPassword')}
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordError(null) }}
            autoComplete="new-password"
            aria-invalid={passwordInvalid}
            aria-describedby={passwordInvalid ? 'password-hint password-error' : 'password-hint'}
            required
          />
          <span className="field-hint" id="password-hint">{t('signup.passwordHint')}</span>
        </label>
        <label className="field">
          {t('signup.confirmPassword')}
          <input
            type="password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setPasswordError(null) }}
            autoComplete="new-password"
            aria-invalid={passwordError === 'signup.passwordMismatch'}
            aria-describedby={passwordError === 'signup.passwordMismatch' ? 'password-error' : undefined}
            required
          />
        </label>
        {passwordError && <p className="form-error" role="alert" id="password-error">{t(passwordError)}</p>}
        {error && <p className="form-error" role="alert">{errorText(error)}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy || code.length !== 6}>
          {busy ? t('forgot.saving') : t('forgot.save')}
        </button>
      </form>
      <p className="auth-switch">
        {wait > 0 ? (
          <span>{t('forgot.resendIn', { seconds: wait })}</span>
        ) : (
          <button type="button" className="link-button" onClick={() => sendCode()} disabled={busy}>
            {t('forgot.resend')}
          </button>
        )}
        {' · '}
        <button type="button" className="link-button" onClick={startOver}>{t('forgot.otherEmail')}</button>
      </p>
    </>
  )
}

export default ForgotPassword

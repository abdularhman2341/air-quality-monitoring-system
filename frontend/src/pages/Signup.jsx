import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'

function passwordErrorKey(password, confirm) {
  if (password.length < 8) return 'signup.passwordTooShort'
  if (new TextEncoder().encode(password).length > 72) return 'signup.passwordTooLong'
  if (password !== confirm) return 'signup.passwordMismatch'
  return null
}

function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordError, setPasswordError] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const { register } = useAuth()
  const { t, errorText } = useLanguage()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const key = passwordErrorKey(password, confirm)
    if (key) {
      setPasswordError(key)
      return
    }
    setSubmitting(true)
    try {
      await register(name, email, password)
    } catch (err) {
      setError(err)
      setSubmitting(false)
    }
  }

  const passwordInvalid = passwordError === 'signup.passwordTooShort' || passwordError === 'signup.passwordTooLong'

  return (
    <>
      <h2>{t('signup.title')}</h2>
      <p className="subtitle">{t('signup.subtitle')}</p>
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          {t('signup.name')}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={100}
            required
          />
        </label>
        <label className="field">
          {t('login.email')}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            dir="ltr"
            required
          />
        </label>
        <label className="field">
          {t('login.password')}
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
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? t('signup.submitting') : t('signup.submit')}
        </button>
      </form>
      <p className="auth-switch">
        {t('signup.haveAccount')} <Link to="/login">{t('signup.signIn')}</Link>
      </p>
    </>
  )
}

export default Signup

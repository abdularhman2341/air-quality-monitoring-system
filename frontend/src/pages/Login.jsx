import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import ActivateAccount from '../components/ActivateAccount'

function Login() {
  const location = useLocation()
  const passwordReset = Boolean(location.state?.passwordReset)
  const [email, setEmail] = useState(location.state?.email || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [inactive, setInactive] = useState(false)
  const { login } = useAuth()
  const { t, errorText } = useLanguage()

  // On success nothing else happens here: the user is set, and GuestRoute
  // moves on to the page they came from. submitting stays true because this
  // page is leaving. An account that was never activated gets a new code by
  // email (403 EMAIL_NOT_VERIFIED), and the page shows the code step.
  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setInactive(err.code === 'EMAIL_NOT_VERIFIED')
      setError(err.code === 'EMAIL_NOT_VERIFIED' ? null : err)
      setSubmitting(false)
    }
  }

  if (inactive) {
    return <ActivateAccount email={email} onBack={() => setInactive(false)} />
  }

  return (
    <>
      <h2>{t('login.title')}</h2>
      <p className="subtitle">{t('login.subtitle')}</p>
      {passwordReset && <p className="form-success" role="status">{t('login.passwordReset')}</p>}
      <form className="form" onSubmit={handleSubmit}>
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
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <Link className="auth-forgot" to="/forgot-password">{t('login.forgot')}</Link>
        {error && <p className="form-error" role="alert">{errorText(error)}</p>}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? t('login.submitting') : t('login.submit')}
        </button>
      </form>
      <p className="auth-switch">
        {t('login.noAccount')} <Link to="/signup">{t('login.createOne')}</Link>
      </p>
    </>
  )
}

export default Login

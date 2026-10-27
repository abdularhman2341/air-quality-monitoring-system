import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const { t, errorText } = useLanguage()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err)
      setSubmitting(false)
    }
  }

  return (
    <>
      <h2>{t('login.title')}</h2>
      <p className="subtitle">{t('login.subtitle')}</p>
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

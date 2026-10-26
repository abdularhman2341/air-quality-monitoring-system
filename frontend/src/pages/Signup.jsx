import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'

function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const { register } = useAuth()
  const { t, errorText } = useLanguage()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await register(name, email, password)
    } catch (err) {
      setError(err)
      setSubmitting(false)
    }
  }

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
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />
          <span className="field-hint">{t('signup.passwordHint')}</span>
        </label>
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

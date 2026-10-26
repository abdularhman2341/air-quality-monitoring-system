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
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>{t('login.title')}</h1>
      <input
        type="email"
        placeholder={t('login.email')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        dir="ltr"
        required
      />
      <input
        type="password"
        placeholder={t('login.password')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={submitting}>
        {submitting ? t('login.submitting') : t('login.submit')}
      </button>
      {error && <p role="alert">{errorText(error)}</p>}
      <p>{t('login.noAccount')} <Link to="/signup">{t('login.createOne')}</Link></p>
    </form>
  )
}

export default Login

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
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>{t('signup.title')}</h1>
      <input
        type="text"
        placeholder={t('signup.name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        required
      />
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
        placeholder={t('signup.password')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        maxLength={72}
        required
      />
      <button type="submit" disabled={submitting}>
        {submitting ? t('signup.submitting') : t('signup.submit')}
      </button>
      {error && <p role="alert">{errorText(error)}</p>}
      <p>{t('signup.haveAccount')} <Link to="/login">{t('signup.signIn')}</Link></p>
    </form>
  )
}

export default Signup

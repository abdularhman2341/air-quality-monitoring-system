import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { useRequest } from '../hooks/useRequest'
import { usePasswordPair } from '../hooks/usePasswordPair'
import ActivateAccount from '../components/ActivateAccount'
import Field from '../components/form/Field'
import FormError from '../components/form/FormError'
import NewPasswordFields from '../components/form/NewPasswordFields'
import SubmitButton from '../components/form/SubmitButton'

// Password rules are checked here first, so the common mistakes get a clear
// message without a request. The backend checks them again. On success the
// page shows the code step; after the code GuestRoute moves on to /add-sensor.
function useSignup() {
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState(null)
  const pair = usePasswordPair()
  const request = useRequest()

  function handleSubmit(e) {
    e.preventDefault()
    request.setError(null)
    if (!pair.check()) return
    request.run(async () => {
      const { email: sent } = await register(name, email, pair.password)
      setSentTo(sent)
    })
  }

  return { name, setName, email, setEmail, pair, sentTo, setSentTo, handleSubmit, ...request }
}

function Signup() {
  const { t } = useLanguage()
  const form = useSignup()

  if (form.sentTo) {
    return <ActivateAccount email={form.sentTo} onBack={() => form.setSentTo(null)} />
  }

  return (
    <>
      <h2>{t('signup.title')}</h2>
      <p className="subtitle">{t('signup.subtitle')}</p>
      <form className="form" onSubmit={form.handleSubmit}>
        <Field label={t('signup.name')} type="text" value={form.name} onChange={form.setName}
          autoComplete="name" maxLength={100} required />
        <Field label={t('login.email')} type="email" value={form.email} onChange={form.setEmail}
          autoComplete="email" dir="ltr" required />
        <NewPasswordFields pair={form.pair} label={t('login.password')} />
        <FormError error={form.error} />
        <SubmitButton busy={form.busy} label={t('signup.submit')} busyLabel={t('signup.submitting')} />
      </form>
      <p className="auth-switch">
        {t('signup.haveAccount')} <Link to="/login">{t('signup.signIn')}</Link>
      </p>
    </>
  )
}

export default Signup

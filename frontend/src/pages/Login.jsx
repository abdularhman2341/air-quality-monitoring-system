import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { useRequest } from '../hooks/useRequest'
import ActivateAccount from '../components/ActivateAccount'
import Field from '../components/form/Field'
import FormError from '../components/form/FormError'
import SubmitButton from '../components/form/SubmitButton'

// On success nothing else happens here: the user is set, and GuestRoute
// moves on to the page they came from, so the button stays busy. An account
// that was never activated gets a new code by email (403 EMAIL_NOT_VERIFIED),
// and the page shows the code step instead of an error.
function useLogin(initialEmail) {
  const { login } = useAuth()
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const request = useRequest()
  const inactive = request.error?.code === 'EMAIL_NOT_VERIFIED'

  function handleSubmit(e) {
    e.preventDefault()
    request.run(() => login(email, password), { stayBusy: true })
  }

  return { email, setEmail, password, setPassword, handleSubmit, inactive, ...request }
}

// The reset page sends the user here with the email and a notice.
function Login() {
  const location = useLocation()
  const { t } = useLanguage()
  const form = useLogin(location.state?.email || '')

  if (form.inactive) {
    return <ActivateAccount email={form.email} onBack={() => form.setError(null)} />
  }

  return (
    <>
      <h2>{t('login.title')}</h2>
      <p className="subtitle">{t('login.subtitle')}</p>
      {location.state?.passwordReset && <p className="form-success" role="status">{t('login.passwordReset')}</p>}
      <LoginForm form={form} />
      <p className="auth-switch">
        {t('login.noAccount')} <Link to="/signup">{t('login.createOne')}</Link>
      </p>
    </>
  )
}

function LoginForm({ form }) {
  const { t } = useLanguage()
  return (
    <form className="form" onSubmit={form.handleSubmit}>
      <Field label={t('login.email')} type="email" value={form.email} onChange={form.setEmail}
        autoComplete="email" dir="ltr" required />
      <Field label={t('login.password')} type="password" value={form.password} onChange={form.setPassword}
        autoComplete="current-password" required />
      <Link className="auth-forgot" to="/forgot-password">{t('login.forgot')}</Link>
      <FormError error={form.error} />
      <SubmitButton busy={form.busy} label={t('login.submit')} busyLabel={t('login.submitting')} />
    </form>
  )
}

export default Login

import { Link } from 'react-router-dom'
import { useLanguage } from '../../i18n/LanguageContext'
import Field from '../../components/form/Field'
import FormError from '../../components/form/FormError'
import SubmitButton from '../../components/form/SubmitButton'
import CodeStep from './CodeStep'
import { useForgotPassword } from './useForgotPassword'

// Two steps on one page: ask for the code, then type it with the new
// password. The server gives the same answer whether or not the email has an
// account, so this page never says "no such account".
function ForgotPassword() {
  const { t } = useLanguage()
  const form = useForgotPassword()

  if (form.step !== 'email') {
    return <CodeStep form={form} />
  }

  return (
    <>
      <h2>{t('forgot.title')}</h2>
      <p className="subtitle">{t('forgot.subtitle')}</p>
      <form className="form" onSubmit={form.sendCode}>
        <Field label={t('login.email')} type="email" value={form.email} onChange={form.setEmail}
          autoComplete="email" dir="ltr" required autoFocus />
        <FormError error={form.request.error} />
        <SubmitButton busy={form.request.busy} label={t('forgot.send')} busyLabel={t('forgot.sending')} />
      </form>
      <p className="auth-switch">
        <Link to="/login">{t('forgot.backToLogin')}</Link>
      </p>
    </>
  )
}

export default ForgotPassword

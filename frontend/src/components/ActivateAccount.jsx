import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import EmailCodeForm from './EmailCodeForm'

// Step 2 of sign-up, and what sign-in shows for an account that was never
// activated: the 6-digit code emailed to `email`. The right code activates
// the account and signs in, then GuestRoute moves on. onBack goes back to
// the form, for example to fix a mistyped email.
function ActivateAccount({ email, onBack }) {
  const { activate } = useAuth()
  const { t } = useLanguage()

  return (
    <>
      <h2>{t('activate.title')}</h2>
      <p className="subtitle">
        {t('activate.body')} <bdi dir="ltr">{email}</bdi>
      </p>
      <EmailCodeForm
        inputId="activate-code"
        submitLabel={t('activate.submit')}
        onSubmit={(code) => activate(email, code)}
        onResend={() => api.resendSignupCode(email)}
      />
      <p className="auth-switch">
        <button type="button" className="link-button" onClick={onBack}>{t('activate.back')}</button>
      </p>
    </>
  )
}

export default ActivateAccount

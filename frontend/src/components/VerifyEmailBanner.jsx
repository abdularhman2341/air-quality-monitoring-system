import { useEffect } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { useToast } from '../toast/ToastContext'
import EmailCodeForm from './EmailCodeForm'
import './VerifyEmailBanner.css'

// Shown on every page until the email is verified. The account works without
// it, except linking a sensor (POST /devices answers 403 EMAIL_NOT_VERIFIED).
function VerifyEmailBanner() {
  const { user, verifyEmail, refreshUser } = useAuth()
  const { t } = useLanguage()
  const showToast = useToast()

  // The email may have been verified somewhere else (another device, or by an
  // admin), so the account is read again when the user comes back to this tab.
  useEffect(() => {
    window.addEventListener('focus', refreshUser)
    return () => window.removeEventListener('focus', refreshUser)
  }, [refreshUser])

  async function submit(code) {
    await verifyEmail(code)
    showToast(t('verify.done'))
  }

  return (
    <section className="verify-banner" aria-label={t('verify.title')}>
      <div className="verify-banner-inner">
        <div className="verify-banner-text">
          <h2>{t('verify.title')}</h2>
          <p>
            {t('verify.body')} <bdi dir="ltr">{user.email}</bdi>. {t('verify.why')}
          </p>
        </div>
        <EmailCodeForm
          inputId="verify-email-code"
          submitLabel={t('verify.submit')}
          onSubmit={submit}
          onResend={() => api.resendVerification()}
        />
      </div>
    </section>
  )
}

export default VerifyEmailBanner

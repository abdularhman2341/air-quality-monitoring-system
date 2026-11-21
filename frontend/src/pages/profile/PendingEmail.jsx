import { useAuth } from '../../auth/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'
import { useRequest } from '../../hooks/useRequest'
import { api } from '../../api/client'
import EmailCodeForm from '../../components/EmailCodeForm'
import FormError from '../../components/form/FormError'

// A new email that is waiting for its code. The account keeps the old email
// until the code is typed, so a wrong address cannot lock the user out.
function PendingEmail() {
  const { user, confirmEmailChange, cancelEmailChange } = useAuth()
  const { t } = useLanguage()
  const showToast = useToast()
  const { error, run } = useRequest()

  const confirm = (code) => confirmEmailChange(code).then(() => showToast(t('profile.emailChanged')))
  const cancel = () => run(() => cancelEmailChange().then(() => showToast(t('profile.changeCancelled'))))

  return (
    <div className="pending-email">
      <div className="pending-email-head">
        <span className="chip chip-warn">{t('profile.pendingTitle')}</span>
        <bdi dir="ltr">{user.pending_email}</bdi>
      </div>
      <p>{t('profile.pendingBody')}</p>
      <EmailCodeForm inputId="change-email-code" submitLabel={t('profile.confirmEmail')}
        onSubmit={confirm} onResend={() => api.resendEmailChange()} />
      <FormError error={error} />
      <button type="button" className="link-button pending-email-cancel" onClick={cancel}>
        {t('profile.cancelChange')}
      </button>
    </div>
  )
}

export default PendingEmail

import { useAuth } from '../../auth/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'
import { useRequest } from '../../hooks/useRequest'
import FormError from '../../components/form/FormError'

// Email when one of the user's sensors starts or ends an alarm. The switch
// saves at once. The server sends these only to a verified email.
function AlertEmails() {
  const { user, updateProfile } = useAuth()
  const { t } = useLanguage()
  const showToast = useToast()
  const { error, busy, run } = useRequest()

  const toggle = (e) => {
    const enabled = e.target.checked
    run(async () => {
      await updateProfile({ alert_emails: enabled })
      showToast(t(enabled ? 'profile.alertEmailsOn' : 'profile.alertEmailsOff'))
    })
  }

  return (
    <div className="profile-section">
      <h2>{t('profile.alertEmailsTitle')}</h2>
      <p>{t('profile.alertEmailsBody')}</p>
      <label className="switch-row">
        <input type="checkbox" role="switch" className="switch" checked={user.alert_emails}
          onChange={toggle} disabled={busy} />
        <span>{t('profile.alertEmailsLabel')}</span>
      </label>
      <FormError error={error} />
    </div>
  )
}

export default AlertEmails

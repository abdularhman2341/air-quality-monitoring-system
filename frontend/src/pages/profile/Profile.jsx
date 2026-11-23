import { useAuth } from '../../auth/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import { formatDate } from '../../utils/format'
import NameForm from './NameForm'
import EmailSection from './EmailSection'
import AlertEmails from './AlertEmails'
import ChangePassword from './ChangePassword'
import LogoutAll from './LogoutAll'
import DeleteAccount from './DeleteAccount'
import './Profile.css'

// The account page: one section per setting, each with its own form and
// request, so an error in one never clears another.
function Profile() {
  const { user } = useAuth()
  const { t, locale } = useLanguage()

  return (
    <section className="card profile-card">
      <div className="profile-head">
        <span className="profile-avatar">{(user.name || '?').trim().charAt(0).toUpperCase()}</span>
        <div>
          <h1>{t('profile.title')}</h1>
          {user.created_at && (
            <div className="profile-since">{t('profile.memberSince', { date: formatDate(user.created_at, locale) })}</div>
          )}
        </div>
      </div>
      <NameForm />
      <EmailSection />
      {typeof user.alert_emails === 'boolean' && <AlertEmails />}
      <ChangePassword />
      <LogoutAll />
      <DeleteAccount />
    </section>
  )
}

export default Profile

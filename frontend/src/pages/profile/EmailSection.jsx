import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import ChangeEmailForm from './ChangeEmailForm'
import PendingEmail from './PendingEmail'

// The current email, then either the change form or the email waiting for
// its code. No new change starts while one is pending.
function EmailSection() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)

  return (
    <div className="profile-section">
      <div className="field">
        {t('profile.email')}
        <div className="email-row">
          <div className="readonly-value" dir="ltr">{user.email}</div>
          {!editing && !user.pending_email && (
            <button type="button" className="btn btn-outline" onClick={() => setEditing(true)}>
              {t('profile.changeEmail')}
            </button>
          )}
        </div>
      </div>
      {editing && <ChangeEmailForm onDone={() => setEditing(false)} />}
      {!editing && user.pending_email && <PendingEmail />}
    </div>
  )
}

export default EmailSection

import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { useToast } from '../toast/ToastContext'
import { formatDate } from '../utils/format'
import { passwordErrorKey } from '../utils/password'
import { api } from '../api/client'
import EmailCodeForm from '../components/EmailCodeForm'
import './Profile.css'

// New email + current password. The server answers 403 WRONG_PASSWORD
// (not 401), so a typo does not sign the user out.
// The email does not change here: the server sends a code to the new address
// and PendingEmail below asks for it.
function ChangeEmailForm({ onDone }) {
  const { user, changeEmail } = useAuth()
  const { t, errorText } = useLanguage()
  const showToast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (email.trim().toLowerCase() === user.email) {
      setError({ code: 'SAME_EMAIL', message: t('profile.sameEmail') })
      return
    }
    setSaving(true)
    try {
      await changeEmail(email.trim(), password)
      showToast(t('profile.emailCodeSent'))
      onDone()
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <form className="form profile-subform" onSubmit={handleSubmit}>
      <label className="field">
        {t('profile.newEmail')}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          dir="ltr"
          required
        />
      </label>
      <label className="field">
        {t('profile.currentPassword')}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          maxLength={72}
          required
        />
      </label>
      {error && <p className="form-error" role="alert">{errorText(error)}</p>}
      <div className="profile-actions profile-actions-end">
        <button type="button" className="btn btn-outline" onClick={onDone}>
          {t('profile.cancel')}
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving || !email.trim() || !password}>
          {saving ? t('profile.saving') : t('profile.saveEmail')}
        </button>
      </div>
    </form>
  )
}

// A new email that is waiting for its code. The account keeps the old email
// until the code is typed, so a wrong address cannot lock the user out.
function PendingEmail() {
  const { user, confirmEmailChange, cancelEmailChange } = useAuth()
  const { t, errorText } = useLanguage()
  const showToast = useToast()
  const [error, setError] = useState(null)

  async function confirm(code) {
    await confirmEmailChange(code)
    showToast(t('profile.emailChanged'))
  }

  async function cancel() {
    setError(null)
    try {
      await cancelEmailChange()
      showToast(t('profile.changeCancelled'))
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div className="pending-email">
      <div className="pending-email-head">
        <span className="chip chip-warn">{t('profile.pendingTitle')}</span>
        <bdi dir="ltr">{user.pending_email}</bdi>
      </div>
      <p>{t('profile.pendingBody')}</p>
      <EmailCodeForm
        inputId="change-email-code"
        submitLabel={t('profile.confirmEmail')}
        onSubmit={confirm}
        onResend={() => api.resendEmailChange()}
      />
      {error && <p className="form-error" role="alert">{errorText(error)}</p>}
      <button type="button" className="link-button pending-email-cancel" onClick={cancel}>
        {t('profile.cancelChange')}
      </button>
    </div>
  )
}

// Email when one of the user's sensors starts or ends an alarm. The switch
// saves at once. The server sends these only to a verified email.
function AlertEmails() {
  const { user, updateProfile } = useAuth()
  const { t, errorText } = useLanguage()
  const showToast = useToast()
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function toggle(e) {
    const enabled = e.target.checked
    setError(null)
    setSaving(true)
    try {
      await updateProfile({ alert_emails: enabled })
      showToast(t(enabled ? 'profile.alertEmailsOn' : 'profile.alertEmailsOff'))
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile-section">
      <h2>{t('profile.alertEmailsTitle')}</h2>
      <p>{t('profile.alertEmailsBody')}</p>
      <label className="switch-row">
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={user.alert_emails}
          onChange={toggle}
          disabled={saving}
        />
        <span>{t('profile.alertEmailsLabel')}</span>
      </label>
      {user.alert_emails && user.email_verified === false && (
        <p className="notice-warn alert-emails-note" role="status">{t('profile.alertEmailsUnverified')}</p>
      )}
      {error && <p className="form-error" role="alert">{errorText(error)}</p>}
    </div>
  )
}

// Current password + the new one twice. The server ends every session and
// gives this device a new token, so the user stays signed in here only.
function ChangePassword() {
  const { changePassword } = useAuth()
  const { t, errorText } = useLanguage()
  const showToast = useToast()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordError, setPasswordError] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  function close() {
    setOpen(false)
    setCurrent('')
    setPassword('')
    setConfirm('')
    setPasswordError(null)
    setError(null)
    setSaving(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const key = passwordErrorKey(password, confirm)
    if (key) {
      setPasswordError(key)
      return
    }
    setSaving(true)
    try {
      await changePassword(current, password)
      close()
      showToast(t('profile.passwordChanged'))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  const passwordInvalid = passwordError === 'signup.passwordTooShort' || passwordError === 'signup.passwordTooLong'

  return (
    <div className="profile-section">
      <h2>{t('profile.passwordTitle')}</h2>
      <p>{t('profile.passwordBody')}</p>
      {!open ? (
        <button type="button" className="btn btn-outline" onClick={() => setOpen(true)}>
          {t('profile.changePassword')}
        </button>
      ) : (
        <form className="form profile-subform" onSubmit={handleSubmit}>
          <label className="field">
            {t('profile.currentPassword')}
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
              autoFocus
            />
          </label>
          <label className="field">
            {t('profile.newPassword')}
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(null) }}
              autoComplete="new-password"
              aria-invalid={passwordInvalid}
              aria-describedby={passwordInvalid ? 'new-password-hint new-password-error' : 'new-password-hint'}
              required
            />
            <span className="field-hint" id="new-password-hint">{t('signup.passwordHint')}</span>
          </label>
          <label className="field">
            {t('signup.confirmPassword')}
            <input
              type="password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setPasswordError(null) }}
              autoComplete="new-password"
              aria-invalid={passwordError === 'signup.passwordMismatch'}
              aria-describedby={passwordError === 'signup.passwordMismatch' ? 'new-password-error' : undefined}
              required
            />
          </label>
          {passwordError && <p className="form-error" role="alert" id="new-password-error">{t(passwordError)}</p>}
          {error && <p className="form-error" role="alert">{errorText(error)}</p>}
          <div className="profile-actions profile-actions-end">
            <button type="button" className="btn btn-outline" onClick={close}>
              {t('profile.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !current || !password || !confirm}>
              {saving ? t('profile.saving') : t('profile.savePassword')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// Ends every session of this account, including any copied token, and keeps
// this device signed in with a new token.
function LogoutAll() {
  const { logoutAll } = useAuth()
  const { t, errorText } = useLanguage()
  const showToast = useToast()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  function close() {
    setOpen(false)
    setPassword('')
    setError(null)
    setSaving(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await logoutAll(password)
      close()
      showToast(t('profile.logoutAllDone'))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <div className="profile-section">
      <h2>{t('profile.logoutAllTitle')}</h2>
      <p>{t('profile.logoutAllBody')}</p>
      {!open ? (
        <button type="button" className="btn btn-outline" onClick={() => setOpen(true)}>
          {t('profile.logoutAll')}
        </button>
      ) : (
        <form className="form profile-subform" onSubmit={handleSubmit}>
          <label className="field">
            {t('profile.currentPassword')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              autoFocus
            />
          </label>
          {error && <p className="form-error" role="alert">{errorText(error)}</p>}
          <div className="profile-actions profile-actions-end">
            <button type="button" className="btn btn-outline" onClick={close}>
              {t('profile.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !password}>
              {saving ? t('profile.saving') : t('profile.logoutAllConfirm')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// Two steps: a button first, then the warning and the password. After the
// account is deleted the session is cleared and the protected routes send
// the user to /login.
function DeleteAccount() {
  const { deleteAccount } = useAuth()
  const { t, errorText } = useLanguage()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)

  function close() {
    setOpen(false)
    setPassword('')
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setDeleting(true)
    try {
      await deleteAccount(password)
    } catch (err) {
      setError(err)
      setDeleting(false)
    }
  }

  return (
    <section className="danger-zone">
      <h2>{t('profile.deleteTitle')}</h2>
      <p>{t('profile.deleteBody')}</p>
      {!open ? (
        <button type="button" className="btn btn-danger-outline" onClick={() => setOpen(true)}>
          {t('profile.deleteAccount')}
        </button>
      ) : (
        <form className="form profile-subform" onSubmit={handleSubmit}>
          <label className="field">
            {t('profile.currentPassword')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              maxLength={72}
              required
              autoFocus
            />
          </label>
          {error && <p className="form-error" role="alert">{errorText(error)}</p>}
          <div className="profile-actions profile-actions-end">
            <button type="button" className="btn btn-outline" onClick={close}>
              {t('profile.cancel')}
            </button>
            <button type="submit" className="btn btn-danger" disabled={deleting || !password}>
              {deleting ? t('profile.deleting') : t('profile.deleteConfirm')}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

function Profile() {
  const { user, updateProfile, logout } = useAuth()
  const { t, errorText, locale } = useLanguage()
  const showToast = useToast()
  const [name, setName] = useState(user.name)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [editingEmail, setEditingEmail] = useState(false)
  const unchanged = !name.trim() || name.trim() === user.name

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await updateProfile({ name: name.trim() })
      showToast(t('profile.saved'))
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card profile-card">
      <div className="profile-head">
        <span className="profile-avatar">{(user.name || '?').trim().charAt(0).toUpperCase()}</span>
        <div>
          <h1>{t('profile.title')}</h1>
          {user.created_at && (
            <div className="profile-since">
              {t('profile.memberSince', { date: formatDate(user.created_at, locale) })}
            </div>
          )}
        </div>
      </div>
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          {t('profile.name')}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={100}
            required
          />
        </label>
        {error && <p className="form-error" role="alert">{errorText(error)}</p>}
        <div className="profile-actions">
          <button type="button" className="btn btn-danger-outline" onClick={logout}>
            {t('header.logout')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || unchanged}>
            {saving ? t('profile.saving') : t('profile.save')}
          </button>
        </div>
      </form>

      <div className="profile-section">
        <div className="field">
          {t('profile.email')}
          <div className="email-row">
            <div className="readonly-value" dir="ltr">{user.email}</div>
            {!editingEmail && !user.pending_email && (
              <button type="button" className="btn btn-outline" onClick={() => setEditingEmail(true)}>
                {t('profile.changeEmail')}
              </button>
            )}
          </div>
        </div>
        {editingEmail && <ChangeEmailForm onDone={() => setEditingEmail(false)} />}
        {!editingEmail && user.pending_email && <PendingEmail />}
      </div>

      {typeof user.alert_emails === 'boolean' && <AlertEmails />}

      <ChangePassword />

      <LogoutAll />

      <DeleteAccount />
    </section>
  )
}

export default Profile

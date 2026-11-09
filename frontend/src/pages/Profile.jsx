import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { useToast } from '../toast/ToastContext'
import { formatDate } from '../utils/format'
import './Profile.css'

// New email + current password. The server answers 403 WRONG_PASSWORD
// (not 401), so a typo does not sign the user out.
function ChangeEmailForm({ onDone }) {
  const { changeEmail } = useAuth()
  const { t, errorText } = useLanguage()
  const showToast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await changeEmail(email.trim(), password)
      showToast(t('profile.emailChanged'))
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
            {!editingEmail && (
              <button type="button" className="btn btn-outline" onClick={() => setEditingEmail(true)}>
                {t('profile.changeEmail')}
              </button>
            )}
          </div>
        </div>
        {editingEmail && <ChangeEmailForm onDone={() => setEditingEmail(false)} />}
      </div>

      <LogoutAll />

      <DeleteAccount />
    </section>
  )
}

export default Profile

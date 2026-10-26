import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { useToast } from '../toast/ToastContext'
import { formatDate } from '../utils/format'
import './Profile.css'

function Profile() {
  const { user, updateProfile, logout } = useAuth()
  const { t, errorText, locale } = useLanguage()
  const showToast = useToast()
  const [name, setName] = useState(user.name)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
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
        <div className="field">
          {t('profile.email')}
          <div className="readonly-value" dir="ltr">{user.email}</div>
        </div>
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
    </section>
  )
}

export default Profile

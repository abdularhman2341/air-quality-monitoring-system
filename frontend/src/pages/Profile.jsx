import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'

function Profile() {
  const { user, updateProfile, logout } = useAuth()
  const { t, errorText, locale } = useLanguage()
  const [name, setName] = useState(user.name)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaved(false)
    setError(null)
    setSaving(true)
    try {
      await updateProfile({ name })
      setSaved(true)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <section>
      <h1>{t('profile.title')}</h1>
      <form onSubmit={handleSubmit}>
        <label>
          {t('profile.name')}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
          />
        </label>
        <button type="submit" disabled={saving || name.trim() === user.name}>
          {saving ? t('profile.saving') : t('profile.save')}
        </button>
        {saved && <p>{t('profile.saved')}</p>}
        {error && <p role="alert">{errorText(error)}</p>}
      </form>

      <p>{t('profile.email', { email: user.email })}</p>
      {memberSince && <p>{t('profile.memberSince', { date: memberSince })}</p>}

      <button onClick={logout}>{t('header.logout')}</button>
    </section>
  )
}

export default Profile

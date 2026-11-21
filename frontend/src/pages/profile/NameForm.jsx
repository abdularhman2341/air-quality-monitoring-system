import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'
import { useRequest } from '../../hooks/useRequest'
import Field from '../../components/form/Field'
import FormError from '../../components/form/FormError'

// Save stays disabled until the trimmed name is new and not empty.
function useNameForm() {
  const { user, updateProfile } = useAuth()
  const { t } = useLanguage()
  const showToast = useToast()
  const [name, setName] = useState(user.name)
  const request = useRequest()
  const unchanged = !name.trim() || name.trim() === user.name

  function handleSubmit(e) {
    e.preventDefault()
    request.run(async () => {
      await updateProfile({ name: name.trim() })
      showToast(t('profile.saved'))
    })
  }

  return { name, setName, unchanged, handleSubmit, ...request }
}

// The display name, with the logout button beside Save.
function NameForm() {
  const { logout } = useAuth()
  const { t } = useLanguage()
  const form = useNameForm()

  return (
    <form className="form" onSubmit={form.handleSubmit}>
      <Field label={t('profile.name')} type="text" value={form.name} onChange={form.setName}
        autoComplete="name" maxLength={100} required />
      <FormError error={form.error} />
      <div className="profile-actions">
        <button type="button" className="btn btn-danger-outline" onClick={logout}>
          {t('header.logout')}
        </button>
        <button type="submit" className="btn btn-primary" disabled={form.busy || form.unchanged}>
          {form.busy ? t('profile.saving') : t('profile.save')}
        </button>
      </div>
    </form>
  )
}

export default NameForm

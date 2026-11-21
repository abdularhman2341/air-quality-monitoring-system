import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'
import { useRequest } from '../../hooks/useRequest'
import Field from '../../components/form/Field'
import FormError from '../../components/form/FormError'
import { FormButtons } from './parts'

// The current email is refused here, so the server is not asked for nothing.
// On success the form closes; its button stays disabled until then.
function useChangeEmail(onDone) {
  const { user, changeEmail } = useAuth()
  const { t } = useLanguage()
  const showToast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const request = useRequest()

  function handleSubmit(e) {
    e.preventDefault()
    if (email.trim().toLowerCase() === user.email) {
      return request.setError({ code: 'SAME_EMAIL', message: t('profile.sameEmail') })
    }
    request.run(async () => {
      await changeEmail(email.trim(), password)
      showToast(t('profile.emailCodeSent'))
      onDone()
    }, { stayBusy: true })
  }

  return { email, setEmail, password, setPassword, handleSubmit, ...request }
}

// New email + current password. The server answers 403 WRONG_PASSWORD
// (not 401), so a typo does not sign the user out.
// The email does not change here: the server sends a code to the new address
// and PendingEmail asks for it.
function ChangeEmailForm({ onDone }) {
  const { t } = useLanguage()
  const form = useChangeEmail(onDone)

  return (
    <form className="form profile-subform" onSubmit={form.handleSubmit}>
      <Field label={t('profile.newEmail')} type="email" value={form.email} onChange={form.setEmail}
        autoComplete="email" dir="ltr" required />
      <Field label={t('profile.currentPassword')} type="password" value={form.password} onChange={form.setPassword}
        autoComplete="current-password" maxLength={72} required />
      <FormError error={form.error} />
      <FormButtons onCancel={onDone} busy={form.busy} disabled={!form.email.trim() || !form.password}
        label={t('profile.saveEmail')} />
    </form>
  )
}

export default ChangeEmailForm

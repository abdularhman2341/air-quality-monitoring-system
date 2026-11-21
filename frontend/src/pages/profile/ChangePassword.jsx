import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'
import { useRequest } from '../../hooks/useRequest'
import { usePasswordPair } from '../../hooks/usePasswordPair'
import Field from '../../components/form/Field'
import FormError from '../../components/form/FormError'
import NewPasswordFields from '../../components/form/NewPasswordFields'
import { FormButtons, FoldedSection } from './parts'

// The local check runs first (length, then the two new passwords match), so
// a typo never reaches the server. onChanged runs after the form closes.
function useChangePassword(onChanged) {
  const { changePassword } = useAuth()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const pair = usePasswordPair()
  const request = useRequest()

  function close() {
    setOpen(false)
    setCurrent('')
    pair.clear()
    request.reset()
  }

  function handleSubmit(e) {
    e.preventDefault()
    request.setError(null)
    if (!pair.check()) return
    request.run(async () => {
      await changePassword(current, pair.password)
      close()
      onChanged()
    })
  }

  return { open, openForm: () => setOpen(true), current, setCurrent, pair, close, handleSubmit, request }
}

// Current password + the new one twice. The server ends every session and
// gives this device a new token, so the user stays signed in here only.
function ChangePassword() {
  const { t } = useLanguage()
  const showToast = useToast()
  const { pair, request, ...form } = useChangePassword(() => showToast(t('profile.passwordChanged')))

  return (
    <FoldedSection title={t('profile.passwordTitle')} body={t('profile.passwordBody')}
      openLabel={t('profile.changePassword')} open={form.open} onOpen={form.openForm}>
      <form className="form profile-subform" onSubmit={form.handleSubmit}>
        <Field label={t('profile.currentPassword')} type="password" value={form.current} onChange={form.setCurrent}
          autoComplete="current-password" required autoFocus />
        <NewPasswordFields pair={pair} label={t('profile.newPassword')} idPrefix="new-" />
        <FormError error={request.error} />
        <FormButtons onCancel={form.close} busy={request.busy}
          disabled={!form.current || !pair.password || !pair.confirm} label={t('profile.savePassword')} />
      </form>
    </FoldedSection>
  )
}

export default ChangePassword

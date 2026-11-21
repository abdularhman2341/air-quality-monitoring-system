import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'
import { useRequest } from '../../hooks/useRequest'
import { passwordErrorKey } from '../../utils/password'
import FormError from '../../components/form/FormError'
import NewPasswordFields from './NewPasswordFields'
import { FormButtons, FoldedSection } from './parts'

const EMPTY = { current: '', password: '', confirm: '' }

// The three inputs and the local check's message, cleared together.
function usePasswordValues() {
  const [values, setValues] = useState(EMPTY)
  const [passwordError, setPasswordError] = useState(null)
  const clear = () => {
    setValues(EMPTY)
    setPasswordError(null)
  }
  return { values, setValues, passwordError, setPasswordError, clear }
}

// The local check runs first (length, then the two new passwords match), so
// a typo never reaches the server.
function useChangePassword() {
  const { changePassword } = useAuth()
  const { t } = useLanguage()
  const showToast = useToast()
  const [open, setOpen] = useState(false)
  const fields = usePasswordValues()
  const request = useRequest()

  function close() {
    setOpen(false)
    fields.clear()
    request.reset()
  }

  function handleSubmit(e) {
    e.preventDefault()
    request.setError(null)
    const key = passwordErrorKey(fields.values.password, fields.values.confirm)
    if (key) return fields.setPasswordError(key)
    request.run(async () => {
      await changePassword(fields.values.current, fields.values.password)
      close()
      showToast(t('profile.passwordChanged'))
    })
  }

  return { open, openForm: () => setOpen(true), fields, close, handleSubmit, request }
}

// Current password + the new one twice. The server ends every session and
// gives this device a new token, so the user stays signed in here only.
function ChangePassword() {
  const { t } = useLanguage()
  const { fields, request, ...form } = useChangePassword()
  const { values } = fields

  return (
    <FoldedSection title={t('profile.passwordTitle')} body={t('profile.passwordBody')}
      openLabel={t('profile.changePassword')} open={form.open} onOpen={form.openForm}>
      <form className="form profile-subform" onSubmit={form.handleSubmit}>
        <NewPasswordFields values={values} setValues={fields.setValues}
          passwordError={fields.passwordError} setPasswordError={fields.setPasswordError} />
        <FormError error={request.error} />
        <FormButtons onCancel={form.close} busy={request.busy}
          disabled={!values.current || !values.password || !values.confirm} label={t('profile.savePassword')} />
      </form>
    </FoldedSection>
  )
}

export default ChangePassword

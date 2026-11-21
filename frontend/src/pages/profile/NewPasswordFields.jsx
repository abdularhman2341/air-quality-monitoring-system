import { useLanguage } from '../../i18n/LanguageContext'
import Field from '../../components/form/Field'

// The three inputs of the password change and the local check's message.
// Typing in a new-password input clears that message.
function NewPasswordFields({ values, setValues, passwordError, setPasswordError }) {
  const { t } = useLanguage()
  const set = (name, clearsCheck) => (value) => {
    setValues((old) => ({ ...old, [name]: value }))
    if (clearsCheck) setPasswordError(null)
  }
  const passwordInvalid = passwordError === 'signup.passwordTooShort' || passwordError === 'signup.passwordTooLong'
  const mismatch = passwordError === 'signup.passwordMismatch'

  return (
    <>
      <Field label={t('profile.currentPassword')} type="password" value={values.current} onChange={set('current')}
        autoComplete="current-password" required autoFocus />
      <Field label={t('profile.newPassword')} type="password" value={values.password} onChange={set('password', true)}
        autoComplete="new-password" aria-invalid={passwordInvalid}
        aria-describedby={passwordInvalid ? 'new-password-hint new-password-error' : 'new-password-hint'} required>
        <span className="field-hint" id="new-password-hint">{t('signup.passwordHint')}</span>
      </Field>
      <Field label={t('signup.confirmPassword')} type="password" value={values.confirm} onChange={set('confirm', true)}
        autoComplete="new-password" aria-invalid={mismatch} aria-describedby={mismatch ? 'new-password-error' : undefined}
        required />
      {passwordError && <p className="form-error" role="alert" id="new-password-error">{t(passwordError)}</p>}
    </>
  )
}

export default NewPasswordFields

import { useLanguage } from '../../i18n/LanguageContext'
import Field from './Field'

// The new password, its confirmation and the local check's message, for a
// pair from usePasswordPair. idPrefix keeps the hint and error ids unique
// on the page; aria-describedby points the inputs at them.
function NewPasswordFields({ pair, label, idPrefix = '' }) {
  const { t } = useLanguage()
  const hintId = `${idPrefix}password-hint`
  const errorId = `${idPrefix}password-error`
  const invalid = pair.error === 'signup.passwordTooShort' || pair.error === 'signup.passwordTooLong'
  const mismatch = pair.error === 'signup.passwordMismatch'

  return (
    <>
      <Field label={label} type="password" value={pair.password} onChange={pair.setPassword}
        autoComplete="new-password" aria-invalid={invalid}
        aria-describedby={invalid ? `${hintId} ${errorId}` : hintId} required>
        <span className="field-hint" id={hintId}>{t('signup.passwordHint')}</span>
      </Field>
      <Field label={t('signup.confirmPassword')} type="password" value={pair.confirm} onChange={pair.setConfirm}
        autoComplete="new-password" aria-invalid={mismatch}
        aria-describedby={mismatch ? errorId : undefined} required />
      {pair.error && <p className="form-error" role="alert" id={errorId}>{t(pair.error)}</p>}
    </>
  )
}

export default NewPasswordFields

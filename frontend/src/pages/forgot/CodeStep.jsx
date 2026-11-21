import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import { usePasswordPair } from '../../hooks/usePasswordPair'
import Field from '../../components/form/Field'
import FormError from '../../components/form/FormError'
import NewPasswordFields from '../../components/form/NewPasswordFields'
import SubmitButton from '../../components/form/SubmitButton'

// After the reset, sign in shows a notice and the email is already typed.
// The button stays busy while the page leaves.
function useResetPassword({ email, request }) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const pair = usePasswordPair()

  function resetPassword(e) {
    e.preventDefault()
    request.setError(null)
    if (!pair.check()) return
    request.run(async () => {
      await api.resetPassword(email.trim(), code, pair.password)
      navigate('/login', { replace: true, state: { passwordReset: true, email: email.trim() } })
    }, { stayBusy: true })
  }

  return { code, setCode, pair, resetPassword }
}

// Step 2: the emailed code and the new password. The code input keeps
// digits only, at most 6, and the button waits for all 6.
function CodeStep({ form }) {
  const { t } = useLanguage()
  const { code, setCode, pair, resetPassword } = useResetPassword(form)

  return (
    <>
      <h2>{t('forgot.codeTitle')}</h2>
      <p className="subtitle">
        {t('forgot.codeSubtitle')} <bdi className="auth-email" dir="ltr">{form.email.trim()}</bdi>
      </p>
      <form className="form" onSubmit={resetPassword}>
        <Field label={t('forgot.code')} className="code-input" type="text" inputMode="numeric" value={code}
          onChange={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} autoComplete="one-time-code"
          dir="ltr" placeholder="000000" aria-describedby="code-hint" required autoFocus>
          <span className="field-hint" id="code-hint">{t('forgot.codeHint')}</span>
        </Field>
        <NewPasswordFields pair={pair} label={t('forgot.newPassword')} />
        <FormError error={form.request.error} />
        <SubmitButton busy={form.request.busy} disabled={code.length !== 6} label={t('forgot.save')}
          busyLabel={t('forgot.saving')} />
      </form>
      <ResendLinks form={form} />
    </>
  )
}

// A new code after the wait, or back to step 1 for another email.
function ResendLinks({ form }) {
  const { t } = useLanguage()
  return (
    <p className="auth-switch">
      {form.wait > 0 ? (
        <span>{t('forgot.resendIn', { seconds: form.wait })}</span>
      ) : (
        <button type="button" className="link-button" onClick={() => form.sendCode()} disabled={form.request.busy}>
          {t('forgot.resend')}
        </button>
      )}
      {' · '}
      <button type="button" className="link-button" onClick={form.startOver}>{t('forgot.otherEmail')}</button>
    </p>
  )
}

export default CodeStep

import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { useCountdown } from '../hooks/useCountdown'
import { useRequest } from '../hooks/useRequest'
import './EmailCodeForm.css'

const RESEND_SECONDS = 60

// Submit and resend share one busy flag and one error. The server refuses a
// new code within a minute of the last one (429 CODE_RECENTLY_SENT); either
// way the next try has to wait. After a right code the page moves on, so the
// buttons stay disabled.
function useEmailCode(onSubmit, onResend) {
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [wait, setWait] = useCountdown()
  const { error, busy, run } = useRequest()

  const submit = (e) => {
    e.preventDefault()
    setSent(false)
    run(() => onSubmit(code), { stayBusy: true })
  }

  const resend = () => {
    setSent(false)
    run(async () => {
      await onResend().catch((err) => {
        if (err.code === 'CODE_RECENTLY_SENT') setWait(RESEND_SECONDS)
        throw err
      })
      setSent(true)
      setWait(RESEND_SECONDS)
    })
  }

  return { code, setCode, busy, error, sent, wait, submit, resend }
}

// A 6-digit code field with its button and "send a new code". Used to
// activate a new account and by the email change in the profile. onSubmit and
// onResend are async; an error they throw is shown under the field.
function EmailCodeForm({ onSubmit, onResend, submitLabel, inputId }) {
  const { t, errorText } = useLanguage()
  const form = useEmailCode(onSubmit, onResend)

  return (
    <form className="code-form" onSubmit={form.submit}>
      <div className="code-form-row">
        <CodeInput id={inputId} form={form} />
        <button type="submit" className="btn btn-primary" disabled={form.busy || form.code.length !== 6}>
          {submitLabel}
        </button>
        {form.wait > 0 ? (
          <span className="code-form-wait">{t('forgot.resendIn', { seconds: form.wait })}</span>
        ) : (
          <button type="button" className="link-button" onClick={form.resend} disabled={form.busy}>
            {t('forgot.resend')}
          </button>
        )}
      </div>
      {form.error && <p className="code-form-message code-form-error" role="alert">{errorText(form.error)}</p>}
      {form.sent && !form.error && <p className="code-form-message" role="status">{t('verify.resent')}</p>}
    </form>
  )
}

// Keeps digits only, at most 6, so a pasted "123 456" still works.
function CodeInput({ id, form }) {
  const { t } = useLanguage()
  return (
    <input
      id={id}
      className="code-form-input"
      type="text"
      inputMode="numeric"
      value={form.code}
      onChange={(e) => form.setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
      autoComplete="one-time-code"
      dir="ltr"
      placeholder="000000"
      aria-label={t('verify.codeLabel')}
      aria-invalid={form.error?.code === 'INVALID_CODE'}
    />
  )
}

export default EmailCodeForm

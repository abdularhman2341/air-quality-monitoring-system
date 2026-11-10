import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import './EmailCodeForm.css'

const RESEND_SECONDS = 60

// A 6-digit code field with its button and "send a new code". Used by the
// verify-email banner and by the email change in the profile. onSubmit and
// onResend are async; an error they throw is shown under the field.
function EmailCodeForm({ onSubmit, onResend, submitLabel, inputId }) {
  const { t, errorText } = useLanguage()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSent(false)
    setBusy(true)
    try {
      await onSubmit(code)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  // The server refuses a new code within a minute of the last one
  // (429 CODE_RECENTLY_SENT). Either way the next try has to wait.
  async function resend() {
    setError(null)
    setSent(false)
    setBusy(true)
    try {
      await onResend()
      setSent(true)
      setWait(RESEND_SECONDS)
    } catch (err) {
      setError(err)
      if (err.code === 'CODE_RECENTLY_SENT') setWait(RESEND_SECONDS)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="code-form" onSubmit={submit}>
      <div className="code-form-row">
        <input
          id={inputId}
          className="code-form-input"
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          autoComplete="one-time-code"
          dir="ltr"
          placeholder="000000"
          aria-label={t('verify.codeLabel')}
          aria-invalid={error?.code === 'INVALID_CODE'}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || code.length !== 6}>
          {submitLabel}
        </button>
        {wait > 0 ? (
          <span className="code-form-wait">{t('forgot.resendIn', { seconds: wait })}</span>
        ) : (
          <button type="button" className="link-button" onClick={resend} disabled={busy}>
            {t('forgot.resend')}
          </button>
        )}
      </div>
      {error && <p className="code-form-message code-form-error" role="alert">{errorText(error)}</p>}
      {sent && !error && <p className="code-form-message" role="status">{t('verify.resent')}</p>}
    </form>
  )
}

export default EmailCodeForm

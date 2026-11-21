import { useState } from 'react'
import { api } from '../../api/client'
import { useRequest } from '../../hooks/useRequest'
import { useCountdown } from '../../hooks/useCountdown'

const RESEND_SECONDS = 60

// The email step and what both steps share: one busy flag and one error, so
// a new code and the reset never run at the same time. The email is sent
// trimmed every time. Starting over unmounts the code step, which drops its
// code and passwords.
export function useForgotPassword() {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [wait, setWait] = useCountdown()
  const request = useRequest()

  const sendCode = (e) => {
    e?.preventDefault()
    request.run(async () => {
      await api.forgotPassword(email.trim())
      setStep('code')
      setWait(RESEND_SECONDS)
    })
  }

  function startOver() {
    setStep('email')
    request.setError(null)
  }

  return { step, email, setEmail, wait, sendCode, startOver, request }
}

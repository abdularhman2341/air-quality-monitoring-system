import { useState } from 'react'
import { passwordErrorKey } from '../utils/password'

// A new password typed twice, and the local check's message. Typing in
// either input clears the message. check() runs the same rules as the
// backend and returns false, with the message shown, when one fails.
export function usePasswordPair() {
  const [password, setPasswordValue] = useState('')
  const [confirm, setConfirmValue] = useState('')
  const [error, setError] = useState(null)

  function check() {
    const key = passwordErrorKey(password, confirm)
    if (key) setError(key)
    return !key
  }

  function clear() {
    setPasswordValue('')
    setConfirmValue('')
    setError(null)
  }

  const setPassword = (value) => { setPasswordValue(value); setError(null) }
  const setConfirm = (value) => { setConfirmValue(value); setError(null) }
  return { password, confirm, error, setPassword, setConfirm, check, clear }
}

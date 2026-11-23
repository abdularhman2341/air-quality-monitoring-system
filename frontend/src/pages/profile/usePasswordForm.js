import { useState } from 'react'
import { useRequest } from '../../hooks/useRequest'

// State of a profile form that opens behind a button and asks only for the
// current password. send(password, close) does the request. freeOnClose
// lets Cancel re-enable the button while a request is still running.
export function usePasswordForm(send, { stayBusy = false, freeOnClose = true } = {}) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const { error, setError, busy, run, reset } = useRequest()

  function close() {
    setOpen(false)
    setPassword('')
    if (freeOnClose) reset()
    else setError(null)
  }

  function handleSubmit(e) {
    e.preventDefault()
    run(() => send(password, close), { stayBusy })
  }

  return { open, openForm: () => setOpen(true), password, setPassword, close, handleSubmit, error, busy }
}

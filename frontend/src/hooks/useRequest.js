import { useState } from 'react'

// The error and busy flag of one form or button that sends a request.
// run() clears the old error, marks the form busy and keeps the error the
// request throws. stayBusy keeps the button disabled after a success, for
// forms that close or leave the page right after. reset() is for closing a
// form: it drops the error and frees the button.
export function useRequest() {
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function run(action, { stayBusy = false } = {}) {
    setError(null)
    setBusy(true)
    try {
      await action()
      if (!stayBusy) setBusy(false)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  function reset() {
    setError(null)
    setBusy(false)
  }

  return { error, setError, busy, run, reset }
}

import { createContext, useContext, useEffect, useRef, useState } from 'react'

const ToastContext = createContext(null)

// One short message at a time at the bottom of the screen; a new one
// replaces the old one. The role="status" region is always on the page and
// only its text changes: screen readers announce changes to a live region
// that already exists, and may miss one created with its text (F15).
export function ToastProvider({ children }) {
  const [message, setMessage] = useState('')
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  function showToast(text) {
    clearTimeout(timer.current)
    setMessage(text)
    timer.current = setTimeout(() => setMessage(''), 2400)
  }

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div role="status">{message && <div className="toast">{message}</div>}</div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

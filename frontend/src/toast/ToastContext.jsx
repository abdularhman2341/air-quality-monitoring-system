import { createContext, useContext, useEffect, useRef, useState } from 'react'

const ToastContext = createContext(null)

// One short message at a time at the bottom of the screen; a new one
// replaces the old one. role="status" lets screen readers announce it.
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
      {message && <div className="toast" role="status">{message}</div>}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

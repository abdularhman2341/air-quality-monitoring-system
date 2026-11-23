import { useEffect, useState } from 'react'

// Seconds left before something may happen again (a new code by email).
// start(seconds) begins the count; it goes down once a second to 0.
export function useCountdown() {
  const [left, setLeft] = useState(0)

  useEffect(() => {
    if (left <= 0) return
    const timer = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(timer)
  }, [left])

  return [left, setLeft]
}

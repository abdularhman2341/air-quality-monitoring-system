import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { keepFresh } from './keepFresh'

// The user's devices, reloaded every refreshMs and on every live event (a
// reading, an alert or a status change can change any device's card), one
// request at a time (see keepFresh). loading is true only until the first
// answer, so the list does not flash.
export function useDevices(refreshMs) {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = () => api.listDevices()
      .then((data) => {
        setDevices(data)
        setError(null)
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false))
    return keepFresh(load, refreshMs)
  }, [refreshMs])

  return { devices, loading, error }
}

import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { onLiveUpdate } from '../realtime/socketClient'

export function useDevices(refreshMs) {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    function load() {
      api.listDevices()
        .then((data) => {
          setDevices(data)
          setError(null)
        })
        .catch((err) => setError(err))
        .finally(() => setLoading(false))
    }

    load()
    const timer = setInterval(load, refreshMs)
    const stopLiveUpdates = onLiveUpdate(load)
    return () => {
      clearInterval(timer)
      stopLiveUpdates()
    }
  }, [refreshMs])

  return { devices, loading, error }
}

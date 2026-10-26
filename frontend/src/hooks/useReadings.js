import { useEffect, useState } from 'react'
import { api } from '../api/client'

export function useReadings(deviceId, refreshMs, limit = 60) {
  const [readings, setReadings] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!deviceId) {
      return
    }

    function load() {
      api.readings(deviceId, { limit })
        .then((result) => {
          setReadings(result.data.slice().reverse())
          setError(null)
        })
        .catch((err) => setError(err))
    }

    load()
    const timer = setInterval(load, refreshMs)
    return () => clearInterval(timer)
  }, [deviceId, refreshMs, limit])

  return { readings, error }
}

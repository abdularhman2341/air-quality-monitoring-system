import { useEffect, useState } from 'react'
import { api } from '../api/client'

export function useReadings(deviceId, refreshMs, limit = 60) {
  const [readings, setReadings] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!deviceId) {
      return
    }

    function load() {
      api.readings(deviceId, { limit })
        .then((result) => {
          setReadings(result.data.slice().reverse())
          setError('')
        })
        .catch((err) => setError(err.message))
    }

    load()
    const timer = setInterval(load, refreshMs)
    return () => clearInterval(timer)
  }, [deviceId, refreshMs, limit])

  return { readings, error }
}
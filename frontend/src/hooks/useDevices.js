import { useEffect, useState } from 'react'
import { api } from '../api/client'

export function useDevices(refreshMs) {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    function load() {
      api.listDevices()
        .then((data) => {
          setDevices(data)
          setError('')
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    }

    load()
    const timer = setInterval(load, refreshMs)
    return () => clearInterval(timer)
  }, [refreshMs])

  return { devices, loading, error }
}
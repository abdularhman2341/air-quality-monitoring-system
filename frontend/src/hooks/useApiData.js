import { useEffect, useRef, useState } from 'react'

export function useApiData(request, key, refreshMs) {
  const [state, setState] = useState({ key: null, data: null, error: null })
  const requestRef = useRef(request)

  useEffect(() => {
    requestRef.current = request
  })

  useEffect(() => {
    if (key === null) {
      return
    }
    let active = true

    function load() {
      requestRef.current()
        .then((data) => active && setState({ key, data, error: null }))
        .catch((error) => active && setState((prev) => ({
          key,
          data: prev.key === key ? prev.data : null,
          error
        })))
    }

    load()
    const timer = refreshMs ? setInterval(load, refreshMs) : null
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [key, refreshMs])

  const current = key !== null && state.key === key
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: key !== null && !current
  }
}

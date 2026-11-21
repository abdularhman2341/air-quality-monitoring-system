import { useEffect, useRef, useState } from 'react'
import { onLiveUpdate } from '../realtime/socketClient'

// Loads data for a page and keeps it fresh: again every refreshMs (if set) and
// on every live event from the socket.
// `key` says what is being shown (for example the device and the filters).
// A new key loads again and never shows the old key's data in between; null
// means "nothing to load yet". On an error, the last good data for the same
// key stays on screen next to the error.
// Loads now, every refreshMs and on every live event, until the returned
// function stops it. An answer that arrives after that is ignored.
function keepLoading(request, key, refreshMs, setState) {
  let active = true

  function load() {
    request()
      .then((data) => active && setState({ key, data, error: null }))
      .catch((error) => active && setState((prev) => ({
        key,
        data: prev.key === key ? prev.data : null,
        error
      })))
  }

  load()
  const timer = refreshMs ? setInterval(load, refreshMs) : null
  const stopLiveUpdates = onLiveUpdate(load)
  return () => {
    active = false
    clearInterval(timer)
    stopLiveUpdates()
  }
}

export function useApiData(request, key, refreshMs) {
  const [state, setState] = useState({ key: null, data: null, error: null })
  const requestRef = useRef(request)

  // Always call the newest request function (it sees the current filters)
  // without restarting the timer on every render.
  useEffect(() => {
    requestRef.current = request
  })

  useEffect(() => {
    if (key === null) {
      return
    }
    return keepLoading(() => requestRef.current(), key, refreshMs, setState)
  }, [key, refreshMs])

  const current = key !== null && state.key === key
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: key !== null && !current
  }
}

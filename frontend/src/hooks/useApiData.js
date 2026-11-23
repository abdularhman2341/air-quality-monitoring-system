import { useEffect, useRef, useState } from 'react'
import { keepFresh } from './keepFresh'

// Loads data for a page and keeps it fresh: again every refreshMs (if set) and
// on the live events that liveFilter(event, data) accepts (every event when
// there is no filter; see realtime/liveFilters.js). One request at a time.
// `key` says what is being shown (for example the device and the filters).
// A new key loads again and never shows the old key's data in between; null
// means "nothing to load yet". On an error, the last good data for the same
// key stays on screen next to the error.
// Loads now and again until the returned function stops it. An answer that
// arrives after that is ignored.
function keepLoading(request, key, refreshMs, setState, wants) {
  let active = true

  // new Promise turns a request that throws at once into a shown error.
  const load = () => new Promise((resolve) => resolve(request()))
    .then((data) => active && setState({ key, data, error: null }))
    .catch((error) => active && setState((prev) => ({
      key,
      data: prev.key === key ? prev.data : null,
      error
    })))

  const stop = keepFresh(load, refreshMs, wants)
  return () => {
    active = false
    stop()
  }
}

export function useApiData(request, key, refreshMs, liveFilter) {
  const [state, setState] = useState({ key: null, data: null, error: null })
  const requestRef = useRef(request)
  const filterRef = useRef(liveFilter)

  // Always use the newest request function and filter (they see the current
  // filters) without restarting the timer on every render.
  useEffect(() => {
    requestRef.current = request
    filterRef.current = liveFilter
  })

  useEffect(() => {
    if (key === null) {
      return
    }
    const wants = (event, data) => !filterRef.current || filterRef.current(event, data)
    return keepLoading(() => requestRef.current(), key, refreshMs, setState, wants)
  }, [key, refreshMs])

  const current = key !== null && state.key === key
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: key !== null && !current
  }
}

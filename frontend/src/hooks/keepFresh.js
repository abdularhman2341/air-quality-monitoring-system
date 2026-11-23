import { onLiveUpdate } from '../realtime/socketClient'

// Calls load() one at a time. A call that comes while a load runs asks for
// one more load after it, so answers arrive in the order they were asked
// (F11) and a burst of calls costs one request, not one each (F10).
// After stop() nothing new starts.
function oneAtATime(load) {
  let stopped = false
  let running = false
  let again = false

  function run() {
    if (stopped) return
    if (running) {
      again = true
      return
    }
    running = true
    // new Promise turns a load that throws at once into a rejected promise,
    // which is ignored here: the caller handles its own errors.
    new Promise((resolve) => resolve(load())).catch(() => {}).finally(() => {
      running = false
      if (again) {
        again = false
        run()
      }
    })
  }
  return { run, stop: () => { stopped = true } }
}

// Runs load() now, every refreshMs (if set) and on each live event that
// wants(event, data) accepts, until the returned function stops it.
export function keepFresh(load, refreshMs, wants = () => true) {
  const loader = oneAtATime(load)
  loader.run()
  const timer = refreshMs ? setInterval(loader.run, refreshMs) : null
  const stopLiveUpdates = onLiveUpdate((event, data) => wants(event, data) && loader.run())
  return () => {
    loader.stop()
    clearInterval(timer)
    stopLiveUpdates()
  }
}

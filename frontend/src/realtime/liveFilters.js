// Which live events should reload a view (see keepFresh). Each filter gets
// the event name and its data from socketClient. "connect" also fires after
// a reconnect, when events may have been missed, so it reloads every view.
// deviceId undefined means any device.

function about(data, deviceId) {
  return !deviceId || data?.device_id === deviceId
}

// A device's readings: a new reading of that device.
export function readingsOf(deviceId) {
  return (event, data) => event === 'connect' || (event === 'reading:new' && about(data, deviceId))
}

// A device's alerts: one opened or closed (both are alert:new), or a reading
// during an alarm, which can raise the open alert's peak without an event.
export function alertsOf(deviceId) {
  return (event, data) => event === 'connect' || (about(data, deviceId)
    && (event === 'alert:new' || (event === 'reading:new' && data?.alarm_active === true)))
}

import { isWarmingUp } from '../../utils/format'

// The colors of each device state: ink for text and lines, dot for the small
// status dot, fill for the area under the chart line.
export const STATE_COLORS = {
  safe: { ink: 'var(--safe-ink)', dot: 'var(--safe-dot)', fill: 'rgba(47, 143, 108, 0.12)' },
  alert: { ink: 'var(--danger-ink)', dot: 'var(--danger-ink)', fill: 'rgba(185, 28, 28, 0.10)' },
  offline: { ink: 'var(--offline-ink)', dot: 'var(--text-faint)', fill: 'rgba(156, 163, 175, 0.15)' },
  warming: { ink: 'var(--warn-ink)', dot: 'var(--warn-ink)', fill: 'rgba(146, 64, 14, 0.10)' }
}

// Offline comes first: an offline device's last reading is not current.
// While the sensor warms up after power-up its readings are not accurate
// and the device does not alarm, so the page says so instead of "safe".
export function deviceState(device) {
  if (device.connection_state !== 'online') {
    return 'offline'
  }
  if (device.latest?.alarm_active) {
    return 'alert'
  }
  return isWarmingUp(device.latest) ? 'warming' : 'safe'
}

export const THRESHOLD_PPM = 1000
export const GAUGE_MAX_PPM = 1500

export function formatPpm(value) {
  return Math.round(value).toLocaleString('en-US')
}

export function formatTime(value, locale) {
  return new Date(value).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  })
}

export function formatDateTime(value, locale, withSeconds = false) {
  return new Date(value).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hourCycle: 'h23'
  })
}

export function formatDate(value, locale) {
  return new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatDuration(ms, t) {
  const total = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) {
    return t('duration.hm', { h: hours, m: minutes })
  }
  if (minutes > 0) {
    return t('duration.ms', { m: minutes, s: seconds })
  }
  return t('duration.s', { s: seconds })
}

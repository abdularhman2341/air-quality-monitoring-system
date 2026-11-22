import { useLanguage } from '../../i18n/LanguageContext'
import { formatDateTime, formatTime } from '../../utils/format'
import { STATE_COLORS } from './deviceState'

function isToday(value) {
  return new Date(value).toDateString() === new Date().toDateString()
}

// Today's readings show the time only; older ones show the date too.
function lastReadingText(value, locale) {
  if (!value) {
    return '—'
  }
  return isToday(value) ? formatTime(value, locale) : formatDateTime(value, locale, true)
}

// Whether the device is online, its MAC and when it last sent a reading.
function SensorCard({ device, state }) {
  const { t, locale } = useLanguage()
  return (
    <div className="card info-card">
      <div className="info-label">{t('dashboard.sensorStatus')}</div>
      <div className="info-title">
        <span className="dot" style={{ background: STATE_COLORS[state].dot }} />
        {state === 'offline' ? t('dashboard.offlineLabel') : t('dashboard.online')}
      </div>
      <dl className="info-list">
        <dt>{t('dashboard.mac')}</dt>
        <dd dir="ltr" className="mono">{device.mac_display}</dd>
        <dt>{t('dashboard.lastReading')}</dt>
        <dd dir="ltr">{lastReadingText(device.last_reading_at, locale)}</dd>
      </dl>
    </div>
  )
}

export default SensorCard

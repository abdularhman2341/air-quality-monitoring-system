import { useLanguage } from '../../i18n/LanguageContext'
import { formatDateTime, formatDuration, formatPpm } from '../../utils/format'

// One row per alert. An alert with no ended_at is still open.
export function AlertsTable({ rows, deviceName }) {
  const { t } = useLanguage()
  return (
    <table>
      <thead>
        <tr>
          <th>{t('history.device')}</th>
          <th>{t('history.started')}</th>
          <th>{t('history.duration')}</th>
          <th className="num">{t('history.peak')}</th>
          <th>{t('history.status')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((alert) => <AlertRow key={alert.id} alert={alert} name={deviceName(alert.device_id)} />)}
      </tbody>
    </table>
  )
}

function AlertRow({ alert, name }) {
  const { t, locale } = useLanguage()
  const active = !alert.ended_at
  return (
    <tr>
      <td className="strong">{name}</td>
      <td className="muted">{formatDateTime(alert.started_at, locale)}</td>
      <td className="muted">
        {active
          ? t('history.ongoing')
          : formatDuration(new Date(alert.ended_at) - new Date(alert.started_at), t)}
      </td>
      <td className={`num strong ${active ? 'danger' : ''}`}>{formatPpm(alert.peak_lpg_ppm_est)}</td>
      <td>
        <span className={`chip ${active ? 'chip-danger' : 'chip-neutral'}`}>
          {active ? t('history.active') : t('history.ended')}
        </span>
      </td>
    </tr>
  )
}

// One row per reading of one device, so every row shows the same name.
export function ReadingsTable({ rows, name }) {
  const { t } = useLanguage()
  return (
    <table>
      <thead>
        <tr>
          <th>{t('history.time')}</th>
          <th>{t('history.device')}</th>
          <th className="num">{t('history.ppm')}</th>
          <th>{t('history.status')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((reading) => <ReadingRow key={reading.id} reading={reading} name={name} />)}
      </tbody>
    </table>
  )
}

function ReadingRow({ reading, name }) {
  const { t, locale } = useLanguage()
  return (
    <tr>
      <td className="muted">{formatDateTime(reading.reading_time, locale, true)}</td>
      <td className="strong">{name}</td>
      <td className={`num strong ${reading.alarm_active ? 'danger' : 'safe'}`}>
        {formatPpm(reading.lpg_ppm_est)}
      </td>
      <td>
        <span className={`chip ${reading.alarm_active ? 'chip-danger' : 'chip-safe'}`}>
          {reading.alarm_active ? t('history.aboveThreshold') : t('history.safe')}
        </span>
      </td>
    </tr>
  )
}

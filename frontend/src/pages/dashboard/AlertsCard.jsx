import { Link } from 'react-router-dom'
import { useLanguage } from '../../i18n/LanguageContext'
import { formatPpm, formatTime } from '../../utils/format'

// Only the newest alert is asked for: it is open when it has no ended_at.
function openAlertOf(data) {
  return data?.data?.[0] && !data.data[0].ended_at ? data.data[0] : null
}

// Until the alerts arrive, or when the request fails, the card says so
// instead of "all normal"; the big status still follows the device's own
// alarm flag (F3).
function AlertsCard({ data, error }) {
  const { t } = useLanguage()
  const openAlert = openAlertOf(data)
  return (
    <div className={`card info-card ${openAlert ? 'alert-active' : ''}`}>
      <div className="info-label">{t('dashboard.alerts')}</div>
      <AlertsStatus data={data} error={error} openAlert={openAlert} />
      <Link to="/history">{t('dashboard.viewHistory')}</Link>
    </div>
  )
}

function AlertsStatus({ data, error, openAlert }) {
  const { t, errorText } = useLanguage()
  if (error) {
    return (
      <>
        <div className="info-title" style={{ color: 'var(--warn-ink)' }}>{t('dashboard.alertsUnknown')}</div>
        <p className="info-body" role="alert">{errorText(error)}</p>
      </>
    )
  }
  if (!data) {
    return <div className="info-title">{t('common.loading')}</div>
  }
  return <AlertSummary openAlert={openAlert} />
}

// An open alert shows when it started and its peak; otherwise all is normal.
function AlertSummary({ openAlert }) {
  const { t, locale } = useLanguage()
  return (
    <>
      <div className="info-title" style={{ color: openAlert ? 'var(--danger-ink)' : 'var(--safe-ink)' }}>
        {openAlert ? t('dashboard.alarmActive') : t('dashboard.noAlerts')}
      </div>
      <p className="info-body">
        {openAlert
          ? t('dashboard.alarmSince', {
            time: formatTime(openAlert.started_at, locale),
            ppm: formatPpm(openAlert.peak_lpg_ppm_est)
          })
          : t('dashboard.allNormal')}
      </p>
    </>
  )
}

export default AlertsCard

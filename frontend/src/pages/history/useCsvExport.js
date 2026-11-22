import { useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'
import { downloadCsv } from '../../utils/csv'

// The backend's largest page (limit 1000), so an export holds the newest
// 1000 rows of the chosen range.
const EXPORT_LIMIT = 1000
const ALERT_COLUMNS = [
  'device', 'device_id', 'started_at', 'ended_at', 'duration_seconds', 'peak_lpg_ppm_est', 'threshold_ppm'
]
const READING_COLUMNS = ['reading_time', 'device', 'lpg_ppm_est', 'alarm_active']

// An open alert has no end, so its end and duration cells stay empty.
function alertRow(a, deviceName) {
  const seconds = a.ended_at ? Math.round((new Date(a.ended_at) - new Date(a.started_at)) / 1000) : ''
  return [deviceName(a.device_id), a.device_id, a.started_at, a.ended_at || '', seconds, a.peak_lpg_ppm_est, a.threshold_ppm]
}

function saveCsv({ tab, readingsDevice }, rows, deviceName) {
  if (tab === 'alerts') {
    downloadCsv('alerts.csv', ALERT_COLUMNS, rows.map((a) => alertRow(a, deviceName)))
  } else {
    const name = deviceName(readingsDevice)
    const csvRows = rows.map((r) => [r.reading_time, name, r.lpg_ppm_est, r.alarm_active])
    downloadCsv(`readings-${readingsDevice}.csv`, READING_COLUMNS, csvRows)
  }
}

// Downloads the current tab and filters as a CSV file, and says how it went
// in a toast. exporting is true while the request runs.
export function useCsvExport(query, deviceName) {
  const { t, errorText } = useLanguage()
  const showToast = useToast()
  const [exporting, setExporting] = useState(false)

  async function exportCsv() {
    setExporting(true)
    try {
      const result = await query.fetchRows({ page: 1, limit: EXPORT_LIMIT })
      saveCsv(query, result.data, deviceName)
      showToast(t('history.exported'))
    } catch (err) {
      showToast(errorText(err))
    } finally {
      setExporting(false)
    }
  }
  return { exporting, exportCsv }
}

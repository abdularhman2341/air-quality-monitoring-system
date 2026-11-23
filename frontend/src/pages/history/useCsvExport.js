import { useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'
import { downloadCsv } from '../../utils/csv'

// The backend's largest page is 1000 rows, so the export asks page after
// page. A file holds at most 20 pages (20,000 rows): a month of readings
// (one every 5 s) is far more, and asking for all of it would hang the tab.
// The toast says when the file holds only the newest rows (F5).
const EXPORT_LIMIT = 1000
const MAX_EXPORT_PAGES = 20
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

// Rows come newest first, so a row that arrives during the export pushes
// one row onto the next page; a row already seen (same id) is skipped.
async function fetchAllRows(query) {
  const rows = []
  const seen = new Set()
  let total = 0
  for (let page = 1; page <= MAX_EXPORT_PAGES; page += 1) {
    const result = await query.fetchRows({ page, limit: EXPORT_LIMIT })
    total = result.total
    rows.push(...result.data.filter((row) => !seen.has(row.id)))
    result.data.forEach((row) => seen.add(row.id))
    if (result.data.length < EXPORT_LIMIT || page * EXPORT_LIMIT >= total) {
      return { rows, total, complete: true }
    }
  }
  return { rows, total, complete: false }
}

function exportedText(t, { rows, total, complete }) {
  return complete ? t('history.exported') : t('history.exportedNewest', { count: rows.length, total })
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
      const result = await fetchAllRows(query)
      saveCsv(query, result.rows, deviceName)
      showToast(exportedText(t, result))
    } catch (err) {
      showToast(errorText(err))
    } finally {
      setExporting(false)
    }
  }
  return { exporting, exportCsv }
}

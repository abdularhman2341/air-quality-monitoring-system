import { useLanguage } from '../../i18n/LanguageContext'
import { PAGE_SIZE } from './useHistoryQuery'
import { AlertsTable, ReadingsTable } from './HistoryTables'

// Why the table is empty: still loading, no alerts, no device to read from,
// or no readings in the period.
function emptyText({ loading, tab }, devices, t) {
  if (loading) {
    return t('common.loading')
  }
  if (tab === 'alerts') {
    return t('history.noAlerts')
  }
  return devices.length === 0 ? t('history.noDevices') : t('history.noReadings')
}

// The table of the chosen tab, or the error, or why it is empty, and the
// pager when there are more rows than one page.
function ResultsCard({ query, devices, deviceName }) {
  const { t, errorText } = useLanguage()
  const { tab, rows, error } = query
  return (
    <div className="table-card card">
      {error && <p className="table-message" role="alert">{errorText(error)}</p>}
      {!error && tab === 'alerts' && <AlertsTable rows={rows} deviceName={deviceName} />}
      {!error && tab === 'readings' && <ReadingsTable rows={rows} name={deviceName(query.readingsDevice)} />}
      {!error && rows.length === 0 && <p className="table-message">{emptyText(query, devices, t)}</p>}
      {query.total > PAGE_SIZE && <Pager page={query.page} total={query.total} onPage={query.setPage} />}
    </div>
  )
}

function Pager({ page, total, onPage }) {
  const { t } = useLanguage()
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastRow = Math.min(page * PAGE_SIZE, total)
  return (
    <div className="pager">
      <span>{t('history.showing', { from: firstRow, to: lastRow, total })}</span>
      <button type="button" className="btn btn-outline" disabled={page === 1} onClick={() => onPage(page - 1)}>
        {t('history.previous')}
      </button>
      <button type="button" className="btn btn-outline" disabled={lastRow >= total} onClick={() => onPage(page + 1)}>
        {t('history.next')}
      </button>
    </div>
  )
}

export default ResultsCard

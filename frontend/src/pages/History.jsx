import { useState } from 'react'
import { api } from '../api/client'
import { useDevices } from '../hooks/useDevices'
import { useApiData } from '../hooks/useApiData'
import { useLanguage } from '../i18n/LanguageContext'
import { useToast } from '../toast/ToastContext'
import { downloadCsv } from '../utils/csv'
import { formatDateTime, formatDuration, formatPpm } from '../utils/format'
import './History.css'

const REFRESH_MS = 15000
const PAGE_SIZE = 50
const EXPORT_LIMIT = 1000
const RANGES = [
  { days: 1, label: 'history.range24h' },
  { days: 7, label: 'history.range7d' },
  { days: 30, label: 'history.range30d' }
]

function since(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function History() {
  const { t, locale, errorText } = useLanguage()
  const showToast = useToast()
  const { devices } = useDevices(60000)
  const [tab, setTab] = useState('alerts')
  const [deviceFilter, setDeviceFilter] = useState('all')
  const [days, setDays] = useState(30)
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const readingsDevice = deviceFilter === 'all' ? devices[0]?.device_id : deviceFilter
  const selectedDevice = tab === 'alerts' ? deviceFilter : readingsDevice || ''

  function fetchAlerts(params) {
    return api.alerts({ device_id: deviceFilter === 'all' ? undefined : deviceFilter, from: since(days), ...params })
  }

  function fetchReadings(params) {
    return api.readings(readingsDevice, { from: since(days), ...params })
  }

  const key = tab === 'alerts' || readingsDevice ? `${tab}|${selectedDevice}|${days}|${page}` : null
  const { data, loading, error } = useApiData(
    () => (tab === 'alerts' ? fetchAlerts : fetchReadings)({ page, limit: PAGE_SIZE }),
    key,
    REFRESH_MS
  )
  const rows = data?.data || []
  const total = data?.total || 0

  function deviceName(id) {
    const device = devices.find((d) => d.device_id === id)
    return device?.name || device?.mac_display || id
  }

  function changeFilter(update) {
    update()
    setPage(1)
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const result = await (tab === 'alerts' ? fetchAlerts : fetchReadings)({ page: 1, limit: EXPORT_LIMIT })
      if (tab === 'alerts') {
        downloadCsv(
          'alerts.csv',
          ['device', 'device_id', 'started_at', 'ended_at', 'duration_seconds', 'peak_lpg_ppm_est', 'threshold_ppm'],
          result.data.map((a) => [
            deviceName(a.device_id),
            a.device_id,
            a.started_at,
            a.ended_at || '',
            a.ended_at ? Math.round((new Date(a.ended_at) - new Date(a.started_at)) / 1000) : '',
            a.peak_lpg_ppm_est,
            a.threshold_ppm
          ])
        )
      } else {
        downloadCsv(
          `readings-${readingsDevice}.csv`,
          ['reading_time', 'device', 'lpg_ppm_est', 'alarm_active'],
          result.data.map((r) => [r.reading_time, deviceName(readingsDevice), r.lpg_ppm_est, r.alarm_active])
        )
      }
      showToast(t('history.exported'))
    } catch (err) {
      showToast(errorText(err))
    } finally {
      setExporting(false)
    }
  }

  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastRow = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="history">
      <div className="page-head">
        <div>
          <h1>{t('history.title')}</h1>
          <p>{t('history.subtitle')}</p>
        </div>
        <div className="segmented" role="tablist">
          {['alerts', 'readings'].map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              onClick={() => changeFilter(() => setTab(name))}
            >
              {t(`history.tab.${name}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="filters card">
        <label className="filter-device">
          {t('history.device')}
          <select value={selectedDevice} onChange={(e) => changeFilter(() => setDeviceFilter(e.target.value))}>
            {tab === 'alerts' && <option value="all">{t('history.allDevices')}</option>}
            {devices.map((d) => (
              <option key={d.device_id} value={d.device_id}>{d.name || d.mac_display}</option>
            ))}
          </select>
        </label>
        <div className="filter-range">
          {t('history.range')}
          <div className="range-buttons">
            {RANGES.map((range) => (
              <button
                key={range.days}
                type="button"
                aria-pressed={days === range.days}
                onClick={() => changeFilter(() => setDays(range.days))}
              >
                {t(range.label)}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-outline export" onClick={exportCsv} disabled={exporting || total === 0}>
          {exporting ? t('history.exporting') : t('history.export')}
        </button>
      </div>

      <div className="table-card card">
        {error && <p className="table-message" role="alert">{errorText(error)}</p>}
        {!error && tab === 'alerts' && (
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
              {rows.map((alert) => {
                const active = !alert.ended_at
                return (
                  <tr key={alert.id}>
                    <td className="strong">{deviceName(alert.device_id)}</td>
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
              })}
            </tbody>
          </table>
        )}
        {!error && tab === 'readings' && (
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
              {rows.map((reading) => (
                <tr key={reading.id}>
                  <td className="muted">{formatDateTime(reading.reading_time, locale, true)}</td>
                  <td className="strong">{deviceName(readingsDevice)}</td>
                  <td className={`num strong ${reading.alarm_active ? 'danger' : 'safe'}`}>
                    {formatPpm(reading.lpg_ppm_est)}
                  </td>
                  <td>
                    <span className={`chip ${reading.alarm_active ? 'chip-danger' : 'chip-safe'}`}>
                      {reading.alarm_active ? t('history.aboveThreshold') : t('history.safe')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!error && rows.length === 0 && (
          <p className="table-message">
            {loading
              ? t('common.loading')
              : tab === 'alerts'
                ? t('history.noAlerts')
                : devices.length === 0
                  ? t('history.noDevices')
                  : t('history.noReadings')}
          </p>
        )}
        {total > PAGE_SIZE && (
          <div className="pager">
            <span>{t('history.showing', { from: firstRow, to: lastRow, total })}</span>
            <button type="button" className="btn btn-outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
              {t('history.previous')}
            </button>
            <button type="button" className="btn btn-outline" disabled={lastRow >= total} onClick={() => setPage(page + 1)}>
              {t('history.next')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default History

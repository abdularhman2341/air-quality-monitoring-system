import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api/client'
import Gauge from '../components/Gauge'
import { useApiData } from '../hooks/useApiData'
import { useDevices } from '../hooks/useDevices'
import { useLanguage } from '../i18n/LanguageContext'
import { GAUGE_MAX_PPM, THRESHOLD_PPM, formatDateTime, formatPpm, formatTime } from '../utils/format'
import './Dashboard.css'

const REFRESH_MS = 10000
const CHART_POINTS = 30
const STATE_COLORS = {
  safe: { ink: 'var(--safe-ink)', dot: 'var(--safe-dot)', fill: 'rgba(47, 143, 108, 0.12)' },
  alert: { ink: 'var(--danger-ink)', dot: 'var(--danger-ink)', fill: 'rgba(185, 28, 28, 0.10)' },
  offline: { ink: 'var(--offline-ink)', dot: 'var(--text-faint)', fill: 'rgba(156, 163, 175, 0.15)' }
}

function deviceState(device) {
  if (device.connection_state !== 'online') {
    return 'offline'
  }
  return device.latest?.alarm_active ? 'alert' : 'safe'
}

function isToday(value) {
  return new Date(value).toDateString() === new Date().toDateString()
}

function Dashboard() {
  const { t, locale, errorText } = useLanguage()
  const location = useLocation()
  const { devices, loading, error } = useDevices(REFRESH_MS)
  const [selectedId, setSelectedId] = useState(location.state?.selected || '')
  const device = devices.find((d) => d.device_id === selectedId) || devices[0]
  const { data: readingData } = useApiData(
    () => api.readings(device.device_id, { limit: CHART_POINTS }),
    device ? `readings|${device.device_id}` : null,
    REFRESH_MS
  )
  const { data: alertData } = useApiData(
    () => api.alerts({ device_id: device.device_id, limit: 1 }),
    device ? `alert|${device.device_id}` : null,
    REFRESH_MS
  )

  if (loading) {
    return <p className="dashboard-message">{t('common.loading')}</p>
  }
  if (error) {
    return <p className="dashboard-message" role="alert">{errorText(error)}</p>
  }
  if (devices.length === 0) {
    return (
      <section className="empty-state card">
        <h2>{t('dashboard.noSensors')}</h2>
        <p>{t('dashboard.noSensorsHint')}</p>
        <Link to="/add-sensor" className="btn btn-primary">{t('header.addSensor')}</Link>
      </section>
    )
  }

  const state = deviceState(device)
  const colors = STATE_COLORS[state]
  const value = device.latest ? device.latest.lpg_ppm_est : null
  const openAlert = alertData?.data?.[0] && !alertData.data[0].ended_at ? alertData.data[0] : null
  const chartData = (readingData?.data || []).slice().reverse().map((r) => ({ time: r.reading_time, ppm: r.lpg_ppm_est }))
  const chartMax = Math.max(GAUGE_MAX_PPM, ...chartData.map((r) => r.ppm))
  const lastReadingAt = device.last_reading_at
    ? isToday(device.last_reading_at)
      ? formatTime(device.last_reading_at, locale)
      : formatDateTime(device.last_reading_at, locale, true)
    : '—'

  return (
    <div className="dashboard">
      <div className="device-pills">
        {devices.map((d) => {
          const pillState = deviceState(d)
          return (
            <button
              key={d.device_id}
              type="button"
              className={`device-pill pill-${pillState}`}
              aria-pressed={d.device_id === device.device_id}
              onClick={() => setSelectedId(d.device_id)}
            >
              <span className="dot" style={{ background: STATE_COLORS[pillState].dot }} />
              <span className="pill-name">{d.name || d.mac_display}</span>
              <span className="pill-ppm">{d.latest ? formatPpm(d.latest.lpg_ppm_est) : '—'}</span>
            </button>
          )
        })}
        <Link to="/add-sensor" className="device-pill pill-add">+ {t('header.addSensor')}</Link>
      </div>

      <section className={`status-hero hero-${state}`}>
        <div>
          <div className="hero-device" style={{ color: colors.ink }}>
            <span className={`dot ${state === 'alert' ? 'pulse' : ''}`} style={{ background: colors.ink }} />
            {device.name || device.mac_display}
            {device.location && ` · ${device.location}`}
          </div>
          <h2 className="hero-word" style={{ color: colors.ink }}>{t(`dashboard.${state}`)}</h2>
          <p className="hero-message">{t(`dashboard.${state}Message`)}</p>
          <p className="hero-advice">{t(`dashboard.${state}Advice`)}</p>
        </div>
        <Gauge
          value={value}
          color={colors.ink}
          unitLabel={t('dashboard.ppmEstimated')}
          thresholdLabel={t('dashboard.threshold', { ppm: formatPpm(THRESHOLD_PPM) })}
        />
      </section>

      <div className="info-cards">
        <div className="card info-card">
          <div className="info-label">{t('dashboard.sensorStatus')}</div>
          <div className="info-title">
            <span className="dot" style={{ background: colors.dot }} />
            {state === 'offline' ? t('dashboard.offlineLabel') : t('dashboard.online')}
          </div>
          <dl className="info-list">
            <dt>{t('dashboard.mac')}</dt>
            <dd dir="ltr" className="mono">{device.mac_display}</dd>
            <dt>{t('dashboard.lastReading')}</dt>
            <dd dir="ltr">{lastReadingAt}</dd>
          </dl>
        </div>

        <div className={`card info-card ${openAlert ? 'alert-active' : ''}`}>
          <div className="info-label">{t('dashboard.alerts')}</div>
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
          <Link to="/history">{t('dashboard.viewHistory')}</Link>
        </div>
      </div>

      <section className="card readings-card">
        <div className="readings-head">
          <h3>{t('dashboard.recentReadings')}</h3>
          <span>{t('dashboard.lastCount', { count: chartData.length })}</span>
          <span className="legend">
            <span className="legend-line" />
            {t('dashboard.threshold', { ppm: formatPpm(THRESHOLD_PPM) })}
          </span>
        </div>
        {chartData.length === 0 ? (
          <p className="dashboard-message">{t('dashboard.noReadings')}</p>
        ) : (
          <div className="chart" dir="ltr">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#f0f1f3" />
                <XAxis
                  dataKey="time"
                  tickFormatter={(v) => formatTime(v, locale)}
                  tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                  minTickGap={40}
                />
                <YAxis
                  domain={[0, chartMax]}
                  ticks={[0, 500, 1000, 1500]}
                  tickFormatter={formatPpm}
                  tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  labelFormatter={(v) => formatTime(v, locale)}
                  formatter={(v) => [`${formatPpm(v)} ppm`, '']}
                  separator=""
                />
                <ReferenceLine y={THRESHOLD_PPM} stroke="var(--text)" strokeDasharray="5 5" />
                <Area
                  type="monotone"
                  dataKey="ppm"
                  stroke={colors.ink}
                  strokeWidth={2.5}
                  fill={colors.fill}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="estimate-note">{t('dashboard.estimateNote')}</p>
      </section>
    </div>
  )
}

export default Dashboard

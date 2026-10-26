import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useDevices } from '../hooks/useDevices'
import { useReadings } from '../hooks/useReadings'
import { useLanguage } from '../i18n/LanguageContext'
import './Dashboard.css'

const REFRESH_MS = 30000

function formatTime(value, locale) {
  return new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

function Dashboard() {
  const { t, errorText, locale } = useLanguage()
  const { devices, loading, error } = useDevices(REFRESH_MS)
  const [selectedId, setSelectedId] = useState('')
  const device = devices.find((d) => d.device_id === selectedId) || devices[0]
  const { readings, error: readingsError } = useReadings(device?.device_id, REFRESH_MS)

  if (loading) {
    return <p className="dashboard-message">{t('common.loading')}</p>
  }
  if (error) {
    return <p className="dashboard-message" role="alert">{errorText(error)}</p>
  }
  if (devices.length === 0) {
    return (
      <div className="dashboard">
        <section className="status-card">
          <h2>{t('dashboard.noSensors')}</h2>
          <p>{t('dashboard.noSensorsHint')}</p>
          <Link to="/add-sensor">{t('header.addSensor')}</Link>
        </section>
      </div>
    )
  }

  const latest = device.latest
  const alarm = Boolean(latest?.alarm_active)
  const online = device.connection_state === 'online'
  const chartData = readings.map((r) => ({ time: formatTime(r.reading_time, locale), ppm: r.lpg_ppm_est }))

  return (
    <div className="dashboard">
      {devices.length > 1 && (
        <select
          className="device-picker"
          value={device.device_id}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {devices.map((d) => (
            <option key={d.device_id} value={d.device_id}>
              {d.name || d.mac_display}
            </option>
          ))}
        </select>
      )}

      <section className={`status-card ${alarm ? 'status-alert' : ''}`}>
        <h2>{alarm ? t('dashboard.alert') : t('dashboard.safe')}</h2>
        <p>{alarm ? t('dashboard.leak') : t('dashboard.noLeak')}</p>
      </section>

      <div className="gas-card">
        <h3>{t('dashboard.gasLevel')}</h3>
        <p dir="ltr">{latest ? `${latest.lpg_ppm_est} ppm` : t('dashboard.noReadings')}</p>
      </div>

      <div className="sensor-card">
        <h3>{t('dashboard.sensorStatus')}</h3>
        <p>{online ? t('dashboard.online') : t('dashboard.offline')}</p>
        <p>{device.name || t('dashboard.unnamed')} · <span dir="ltr">{device.mac_display}</span></p>
        {device.last_reading_at && (
          <p>{t('dashboard.lastReading', { time: formatTime(device.last_reading_at, locale) })}</p>
        )}
      </div>

      <div className={`alerts-card ${alarm ? 'alerts-active' : ''}`}>
        <h3>{alarm ? t('dashboard.alarmActive') : t('dashboard.noAlerts')}</h3>
        <p>{alarm ? t('dashboard.alarmHint') : t('dashboard.allNormal')}</p>
      </div>

      <div className="readings-card">
        <h3>{t('dashboard.recentReadings')}</h3>
        <p>{t('dashboard.lastCount', { count: chartData.length })}</p>
        {readingsError && <p role="alert">{errorText(readingsError)}</p>}
        <div dir="ltr">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="ppm" stroke="#0f6b4a" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

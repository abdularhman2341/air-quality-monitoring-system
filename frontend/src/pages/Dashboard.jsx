import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useDevices } from '../hooks/useDevices'
import { useReadings } from '../hooks/useReadings'
import './Dashboard.css'

const REFRESH_MS = 30000

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function Dashboard() {
  const { devices, loading, error } = useDevices(REFRESH_MS)
  const [selectedId, setSelectedId] = useState('')
  const device = devices.find((d) => d.device_id === selectedId) || devices[0]
  const { readings, error: readingsError } = useReadings(device?.device_id, REFRESH_MS)

  if (loading) {
    return <p className="dashboard-message">Loading…</p>
  }
  if (error) {
    return <p className="dashboard-message" role="alert">{error}</p>
  }
  if (devices.length === 0) {
    return (
      <div className="dashboard">
        <section className="status-card">
          <h2>No sensors yet</h2>
          <p>Link your first sensor to start monitoring.</p>
          <Link to="/add-sensor">Add Sensor</Link>
        </section>
      </div>
    )
  }

  const latest = device.latest
  const alarm = Boolean(latest?.alarm_active)
  const online = device.connection_state === 'online'
  const chartData = readings.map((r) => ({ time: formatTime(r.reading_time), ppm: r.lpg_ppm_est }))

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
        <h2>{alarm ? 'ALERT' : 'SAFE'}</h2>
        <p>{alarm ? 'Gas leak detected' : 'No gas leak detected'}</p>
      </section>

      <div className="gas-card">
        <h3>Gas Level</h3>
        <p>{latest ? `${latest.lpg_ppm_est} ppm` : 'No readings yet'}</p>
      </div>

      <div className="sensor-card">
        <h3>Sensor Status</h3>
        <p>{online ? 'Online' : 'Offline'}</p>
        <p>{device.name || 'Unnamed sensor'} · {device.mac_display}</p>
        {device.last_reading_at && <p>Last reading {formatTime(device.last_reading_at)}</p>}
      </div>

      <div className={`alerts-card ${alarm ? 'alerts-active' : ''}`}>
        <h3>{alarm ? 'Alarm active' : 'No active alerts'}</h3>
        <p>{alarm ? 'Ventilate the area and check the gas source.' : 'Everything looks normal.'}</p>
      </div>

      <div className="readings-card">
        <h3>Recent Readings</h3>
        <p>Last {chartData.length} readings</p>
        {readingsError && <p role="alert">{readingsError}</p>}
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
  )
}

export default Dashboard
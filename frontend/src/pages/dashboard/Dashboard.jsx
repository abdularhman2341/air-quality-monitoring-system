import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../../api/client'
import { useApiData } from '../../hooks/useApiData'
import { useDevices } from '../../hooks/useDevices'
import { useLanguage } from '../../i18n/LanguageContext'
import { deviceState } from './deviceState'
import DevicePills from './DevicePills'
import StatusHero from './StatusHero'
import SensorCard from './SensorCard'
import AlertsCard from './AlertsCard'
import ReadingsCard from './ReadingsCard'
import './Dashboard.css'

// Live socket events refresh the page at once; this timer is only a backup.
const REFRESH_MS = 60000
const CHART_POINTS = 30

// The selected device's recent readings and its newest alert. Nothing is
// asked for while there is no device.
function useDeviceDetails(device) {
  const { data: readingData } = useApiData(
    () => api.readings(device.device_id, { limit: CHART_POINTS }),
    device ? `readings|${device.device_id}` : null,
    REFRESH_MS
  )
  const { data: alertData, error: alertError } = useApiData(
    () => api.alerts({ device_id: device.device_id, limit: 1 }),
    device ? `alert|${device.device_id}` : null,
    REFRESH_MS
  )
  return { readingData, alertData, alertError }
}

// What the page shows when there is no device to show: still loading, the
// error, or no sensors yet. Checked in that order.
function NoDevice({ loading, error }) {
  const { t, errorText } = useLanguage()
  if (loading) {
    return <p className="dashboard-message">{t('common.loading')}</p>
  }
  if (error) {
    return <p className="dashboard-message" role="alert">{errorText(error)}</p>
  }
  return (
    <section className="empty-state card">
      <h2>{t('dashboard.noSensors')}</h2>
      <p>{t('dashboard.noSensorsHint')}</p>
      <Link to="/add-sensor" className="btn btn-primary">{t('header.addSensor')}</Link>
    </section>
  )
}

function Dashboard() {
  const location = useLocation()
  const { devices, loading, error } = useDevices(REFRESH_MS)
  // AddSensor opens the dashboard on the device it just linked. An unknown or
  // removed id falls back to the first device.
  const [selectedId, setSelectedId] = useState(location.state?.selected || '')
  const device = devices.find((d) => d.device_id === selectedId) || devices[0]
  const { readingData, alertData, alertError } = useDeviceDetails(device)

  if (loading || error || devices.length === 0) {
    return <NoDevice loading={loading} error={error} />
  }
  const state = deviceState(device)
  return (
    <div className="dashboard">
      <DevicePills devices={devices} selectedId={device.device_id} onSelect={setSelectedId} />
      <StatusHero device={device} state={state} />
      <div className="info-cards">
        <SensorCard device={device} state={state} />
        <AlertsCard data={alertData} error={alertError} />
      </div>
      <ReadingsCard data={readingData} state={state} />
    </div>
  )
}

export default Dashboard

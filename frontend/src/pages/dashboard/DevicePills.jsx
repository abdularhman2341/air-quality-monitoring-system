import { Link } from 'react-router-dom'
import { useLanguage } from '../../i18n/LanguageContext'
import { formatPpm } from '../../utils/format'
import { STATE_COLORS, deviceState } from './deviceState'

// One button per device, each with its own state dot and last ppm, then a
// link to add another sensor. The pressed button is the device on screen.
function DevicePills({ devices, selectedId, onSelect }) {
  const { t } = useLanguage()
  return (
    <div className="device-pills">
      {devices.map((d) => (
        <DevicePill key={d.device_id} device={d} pressed={d.device_id === selectedId} onSelect={onSelect} />
      ))}
      <Link to="/add-sensor" className="device-pill pill-add">+ {t('header.addSensor')}</Link>
    </div>
  )
}

function DevicePill({ device, pressed, onSelect }) {
  const state = deviceState(device)
  return (
    <button
      type="button"
      className={`device-pill pill-${state}`}
      aria-pressed={pressed}
      onClick={() => onSelect(device.device_id)}
    >
      <span className="dot" style={{ background: STATE_COLORS[state].dot }} />
      <span className="pill-name">{device.name || device.mac_display}</span>
      <span className="pill-ppm">{device.latest ? formatPpm(device.latest.lpg_ppm_est) : '—'}</span>
    </button>
  )
}

export default DevicePills

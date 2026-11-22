import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { useRequest } from '../../hooks/useRequest'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'

// Removing = unlinking (DELETE /devices/:mac): the device is kept and can be
// added again with its pairing code, but its readings and alerts are
// deleted, so the next owner does not see this user's history. Two steps,
// because it cannot be undone. One error line serves the list and the remove.
function useMySensors() {
  const { t } = useLanguage()
  const showToast = useToast()
  const [devices, setDevices] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const { error, setError, busy, run } = useRequest()

  function load() {
    api.listDevices()
      .then(setDevices)
      .catch((err) => setError(err))
  }

  // setError is a state setter from useRequest, so this still runs once.
  useEffect(load, [setError])

  const remove = (device) => run(async () => {
    await api.unlinkDevice(device.device_id)
    showToast(t('sensors.removed', { name: device.name }))
    setConfirming(null)
    load()
  })
  const ask = (device) => {
    setError(null)
    setConfirming(device.device_id)
  }
  return { devices, confirming, removing: busy, error, ask, cancel: () => setConfirming(null), remove }
}

// The user's sensors, each with a Remove button.
function MySensors() {
  const { t, errorText } = useLanguage()
  const { devices, error, ...actions } = useMySensors()
  return (
    <div className="card my-sensors">
      <h2>{t('sensors.title')}</h2>
      {devices === null && !error && <p className="sensors-empty">{t('common.loading')}</p>}
      {devices && devices.length === 0 && <p className="sensors-empty">{t('sensors.empty')}</p>}
      {devices && devices.length > 0 && (
        <ul className="sensor-list">
          {devices.map((device) => <SensorRow key={device.device_id} device={device} {...actions} />)}
        </ul>
      )}
      {error && <p className="form-error" role="alert">{errorText(error)}</p>}
    </div>
  )
}

function SensorRow({ device, confirming, removing, ask, cancel, remove }) {
  const { t } = useLanguage()
  return (
    <li className="sensor-row">
      <div className="sensor-info">
        <div className="sensor-name">{device.name}</div>
        <div className="sensor-mac" dir="ltr">{device.mac_display}</div>
      </div>
      {confirming === device.device_id ? (
        <RemoveConfirm device={device} removing={removing} cancel={cancel} remove={remove} />
      ) : (
        <button type="button" className="btn btn-danger-outline" onClick={() => ask(device)}>
          {t('sensors.remove')}
        </button>
      )}
    </li>
  )
}

// Both buttons stay disabled while the remove runs.
function RemoveConfirm({ device, removing, cancel, remove }) {
  const { t } = useLanguage()
  return (
    <div className="sensor-confirm">
      <p>{t('sensors.confirm', { name: device.name })}</p>
      <div className="sensor-confirm-actions">
        <button type="button" className="btn btn-outline" onClick={cancel} disabled={removing}>
          {t('addSensor.cancel')}
        </button>
        <button type="button" className="btn btn-danger" onClick={() => remove(device)} disabled={removing}>
          {removing ? t('sensors.removing') : t('sensors.remove')}
        </button>
      </div>
    </div>
  )
}

export default MySensors

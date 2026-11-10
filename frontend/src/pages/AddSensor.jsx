import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { useToast } from '../toast/ToastContext'
import './AddSensor.css'

const STEPS = [1, 2, 3]

function cleanMac(value) {
  return value.toUpperCase().replace(/[^0-9A-F]/g, '')
}

// The user's sensors with a Remove button. Removing = unlinking
// (DELETE /devices/:mac): the device is kept and can be added again with its
// pairing code, but its readings and alerts are deleted, so the next owner
// does not see this user's history. Two steps, because it cannot be undone.
function MySensors() {
  const { t, errorText } = useLanguage()
  const showToast = useToast()
  const [devices, setDevices] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState(null)

  function load() {
    api.listDevices()
      .then(setDevices)
      .catch((err) => setError(err))
  }

  useEffect(load, [])

  async function remove(device) {
    setError(null)
    setRemoving(true)
    try {
      await api.unlinkDevice(device.device_id)
      showToast(t('sensors.removed', { name: device.name }))
      setConfirming(null)
      load()
    } catch (err) {
      setError(err)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="card my-sensors">
      <h2>{t('sensors.title')}</h2>
      {devices === null && !error && <p className="sensors-empty">{t('common.loading')}</p>}
      {devices && devices.length === 0 && <p className="sensors-empty">{t('sensors.empty')}</p>}
      {devices && devices.length > 0 && (
        <ul className="sensor-list">
          {devices.map((device) => (
            <li key={device.device_id} className="sensor-row">
              <div className="sensor-info">
                <div className="sensor-name">{device.name}</div>
                <div className="sensor-mac" dir="ltr">{device.mac_display}</div>
              </div>
              {confirming === device.device_id ? (
                <div className="sensor-confirm">
                  <p>{t('sensors.confirm', { name: device.name })}</p>
                  <div className="sensor-confirm-actions">
                    <button type="button" className="btn btn-outline" onClick={() => setConfirming(null)} disabled={removing}>
                      {t('addSensor.cancel')}
                    </button>
                    <button type="button" className="btn btn-danger" onClick={() => remove(device)} disabled={removing}>
                      {removing ? t('sensors.removing') : t('sensors.remove')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger-outline"
                  onClick={() => { setError(null); setConfirming(device.device_id) }}
                >
                  {t('sensors.remove')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="form-error" role="alert">{errorText(error)}</p>}
    </div>
  )
}

function AddSensor() {
  const [macAddress, setMacAddress] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const [macInvalid, setMacInvalid] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const showToast = useToast()
  const { t, errorText } = useLanguage()
  const { user } = useAuth()

  function validate() {
    if (cleanMac(macAddress).length !== 12) {
      setMacInvalid(true)
      return t('addSensor.errorMac')
    }
    if (!pairingCode.trim()) {
      return t('addSensor.errorCode')
    }
    if (!name.trim()) {
      return t('addSensor.errorName')
    }
    return ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMacInvalid(false)
    const message = validate()
    setError(message)
    if (message) {
      return
    }
    setSubmitting(true)
    try {
      const device = await api.linkDevice({
        mac_address: macAddress.trim(),
        pairing_code: pairingCode.trim(),
        name: name.trim(),
        location: location.trim() || undefined
      })
      showToast(t('addSensor.added'))
      navigate('/', { state: { selected: device.device_id } })
    } catch (err) {
      setMacInvalid(err.code === 'INVALID_MAC')
      setError(errorText(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="add-sensor">
      <div className="card add-sensor-card">
        <h1>{t('addSensor.title')}</h1>
        <p className="subtitle">{t('addSensor.hint')}</p>
        {user.email_verified === false && <p className="notice-warn" role="status">{t('addSensor.verifyFirst')}</p>}
        <form className="form" onSubmit={handleSubmit} noValidate>
          <label className="field">
            {t('addSensor.mac')}
            <input
              type="text"
              className="mono-input"
              value={macAddress}
              onChange={(e) => setMacAddress(e.target.value)}
              placeholder="A4:CF:12:3B:9E:01"
              maxLength={17}
              aria-invalid={macInvalid}
              dir="ltr"
            />
          </label>
          <label className="field">
            {t('addSensor.code')}
            <input
              type="text"
              className="mono-input code-input"
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value)}
              placeholder="482913"
              maxLength={32}
              dir="ltr"
            />
          </label>
          <label className="field">
            {t('addSensor.name')}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('addSensor.namePlaceholder')}
              maxLength={100}
            />
          </label>
          <label className="field">
            {t('addSensor.location')}
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={150}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <Link to="/" className="btn btn-outline">{t('addSensor.cancel')}</Link>
            <button type="submit" className="btn btn-primary" disabled={submitting || user.email_verified === false}>
              {submitting ? t('addSensor.submitting') : t('addSensor.submit')}
            </button>
          </div>
        </form>
      </div>

      <div className="add-sensor-side">
        <MySensors />
        <ol className="add-steps">
          {STEPS.map((step) => (
            <li key={step}>
              <span className="step-number">{step}</span>
              <div>
                <div className="step-title">{t(`addSensor.step${step}Title`)}</div>
                <div className="step-body">{t(`addSensor.step${step}Body`)}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export default AddSensor

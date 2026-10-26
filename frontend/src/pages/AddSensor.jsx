import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../i18n/LanguageContext'

function AddSensor() {
  const [macAddress, setMacAddress] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { t, errorText } = useLanguage()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api.linkDevice({
        mac_address: macAddress,
        pairing_code: pairingCode,
        name,
        location: location || undefined
      })
      navigate('/')
    } catch (err) {
      setError(err)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>{t('addSensor.title')}</h1>
      <p>{t('addSensor.hint')}</p>
      <input
        type="text"
        placeholder={t('addSensor.mac')}
        value={macAddress}
        onChange={(e) => setMacAddress(e.target.value)}
        maxLength={17}
        dir="ltr"
        required
      />
      <input
        type="text"
        placeholder={t('addSensor.code')}
        value={pairingCode}
        onChange={(e) => setPairingCode(e.target.value)}
        maxLength={32}
        dir="ltr"
        required
      />
      <input
        type="text"
        placeholder={t('addSensor.name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        required
      />
      <input
        type="text"
        placeholder={t('addSensor.location')}
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        maxLength={150}
      />
      <button type="submit" disabled={submitting}>
        {submitting ? t('addSensor.submitting') : t('addSensor.submit')}
      </button>
      {error && <p role="alert">{errorText(error)}</p>}
    </form>
  )
}

export default AddSensor

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

function AddSensor() {
  const [macAddress, setMacAddress] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
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
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Add Sensor</h1>
      <p>Enter the MAC address and pairing code printed on your sensor.</p>
      <input
        type="text"
        placeholder="MAC ADDRESS (A4:CF:12:3B:9E:01)"
        value={macAddress}
        onChange={(e) => setMacAddress(e.target.value)}
        maxLength={17}
        required
      />
      <input
        type="text"
        placeholder="PAIRING CODE"
        value={pairingCode}
        onChange={(e) => setPairingCode(e.target.value)}
        maxLength={32}
        required
      />
      <input
        type="text"
        placeholder="NAME (Kitchen)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        required
      />
      <input
        type="text"
        placeholder="LOCATION (optional)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        maxLength={150}
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add Sensor'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

export default AddSensor
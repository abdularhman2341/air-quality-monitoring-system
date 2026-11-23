import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'

// The MAC without the separators people type between the pairs (spaces,
// dots, colons, dashes). The server accepts only colons or dashes, so the
// page sends the 12 digits (F7). Any other character stays, so a typo such as
// a G is refused instead of dropped.
function cleanMac(value) {
  return value.toUpperCase().replace(/[\s.:-]/g, '')
}

// The first problem with the form as a translation key, checked in the order
// of the fields; '' when there is none. The server checks everything again.
function firstProblem({ macAddress, pairingCode, name }) {
  if (!/^[0-9A-F]{12}$/.test(cleanMac(macAddress))) {
    return 'addSensor.errorMac'
  }
  if (!pairingCode.trim()) {
    return 'addSensor.errorCode'
  }
  return name.trim() ? '' : 'addSensor.errorName'
}

// An empty location is left out of the request rather than sent as ''.
function toRequest({ macAddress, pairingCode, name, location }) {
  return {
    mac_address: cleanMac(macAddress),
    pairing_code: pairingCode.trim(),
    name: name.trim(),
    location: location.trim() || undefined
  }
}

// Links the device in fields to the account, then opens the dashboard on it.
// problem.macInvalid marks the MAC field for our own check and for the
// server's INVALID_MAC. After a success the button stays busy: the page is
// leaving.
export function useLinkDevice(fields) {
  const navigate = useNavigate()
  const showToast = useToast()
  const { t, errorText } = useLanguage()
  const [problem, setProblem] = useState({ error: '', macInvalid: false })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const key = firstProblem(fields)
    setProblem({ error: key ? t(key) : '', macInvalid: key === 'addSensor.errorMac' })
    if (key) {
      return
    }
    setSubmitting(true)
    try {
      const device = await api.linkDevice(toRequest(fields))
      showToast(t('addSensor.added'))
      navigate('/', { state: { selected: device.device_id } })
    } catch (err) {
      setProblem({ error: errorText(err), macInvalid: err.code === 'INVALID_MAC' })
      setSubmitting(false)
    }
  }
  return { ...problem, submitting, handleSubmit }
}

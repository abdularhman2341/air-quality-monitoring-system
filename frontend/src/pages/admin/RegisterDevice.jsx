import { useState } from 'react'
import { api } from '../../api/client'
import Field from '../../components/form/Field'
import { useRequest } from '../../hooks/useRequest'
import { useLanguage } from '../../i18n/LanguageContext'
import { PairingCodeBox } from './shared'
import { useAdminOnlyCheck } from './adminUtils'

const EMPTY = { mac: '', name: '', location: '' }

// Empty name and location are left out of the request.
function toRequest({ mac, name, location }) {
  return { mac_address: mac.trim(), name: name.trim() || undefined, location: location.trim() || undefined }
}

// The form's fields, its request, and the code of the device it just
// registered. A success empties the form and reloads the list.
function useRegisterDevice(onRegistered) {
  const [values, setValues] = useState(EMPTY)
  const [created, setCreated] = useState(null)
  const request = useRequest()
  useAdminOnlyCheck(request.error)
  const set = (key) => (value) => setValues((current) => ({ ...current, [key]: value }))

  function submit(e) {
    e.preventDefault()
    request.run(async () => {
      const result = await api.admin.registerDevice(toRequest(values))
      setCreated({ mac: result.device.mac_display, code: result.pairing_code })
      setValues(EMPTY)
      onRegistered()
    })
  }
  return { ...request, values, set, created, setCreated, submit }
}

// Registers a new device and shows its pairing code once (PairingCodeBox).
function RegisterDevice({ onRegistered }) {
  const { t, errorText } = useLanguage()
  const form = useRegisterDevice(onRegistered)
  if (form.created) {
    return <PairingCodeBox mac={form.created.mac} code={form.created.code} onDone={() => form.setCreated(null)} />
  }
  return (
    <form className="card admin-register" onSubmit={form.submit} noValidate>
      <h2>{t('admin.devices.register')}</h2>
      <div className="admin-register-fields">
        <RegisterFields form={form} />
        <button type="submit" className="btn btn-primary" disabled={form.busy || !form.values.mac.trim()}>
          {form.busy ? t('admin.working') : t('admin.devices.registerSubmit')}
        </button>
      </div>
      {form.error && <p className="form-error" role="alert">{errorText(form.error)}</p>}
    </form>
  )
}

// The MAC field is marked for a malformed MAC or one already registered.
function RegisterFields({ form }) {
  const { t } = useLanguage()
  const { values, set, error } = form
  return (
    <>
      <Field
        label={t('addSensor.mac')} className="mono-input" value={values.mac} onChange={set('mac')}
        placeholder="A4:CF:12:3B:9E:01" maxLength={17} dir="ltr"
        aria-invalid={error?.code === 'INVALID_MAC' || error?.code === 'DEVICE_EXISTS'}
      />
      <Field label={t('addSensor.name')} value={values.name} onChange={set('name')} maxLength={100} />
      <Field label={t('addSensor.location')} value={values.location} onChange={set('location')} maxLength={150} />
    </>
  )
}

export default RegisterDevice

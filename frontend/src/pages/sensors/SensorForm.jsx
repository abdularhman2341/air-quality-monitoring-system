import { useState } from 'react'
import { Link } from 'react-router-dom'
import Field from '../../components/form/Field'
import SubmitButton from '../../components/form/SubmitButton'
import { useLanguage } from '../../i18n/LanguageContext'
import { useLinkDevice } from './useLinkDevice'

const EMPTY = { macAddress: '', pairingCode: '', name: '', location: '' }

// The form that links a sensor with the MAC and pairing code on its label.
function SensorForm() {
  const { t } = useLanguage()
  const [fields, setFields] = useState(EMPTY)
  const set = (key) => (value) => setFields((current) => ({ ...current, [key]: value }))
  const { error, macInvalid, submitting, handleSubmit } = useLinkDevice(fields)

  return (
    <div className="card add-sensor-card">
      <h1>{t('addSensor.title')}</h1>
      <p className="subtitle">{t('addSensor.hint')}</p>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <SensorFields fields={fields} set={set} macInvalid={macInvalid} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <Link to="/" className="btn btn-outline">{t('addSensor.cancel')}</Link>
          <SubmitButton busy={submitting} label={t('addSensor.submit')} busyLabel={t('addSensor.submitting')} />
        </div>
      </form>
    </div>
  )
}

// The MAC and code are typed exactly as printed, so they stay left to right.
// The lengths match the backend's limits.
function SensorFields({ fields, set, macInvalid }) {
  const { t } = useLanguage()
  return (
    <>
      <Field
        label={t('addSensor.mac')} type="text" className="mono-input" value={fields.macAddress}
        onChange={set('macAddress')} placeholder="A4:CF:12:3B:9E:01" maxLength={17} aria-invalid={macInvalid} dir="ltr"
      />
      <Field
        label={t('addSensor.code')} type="text" className="mono-input code-input" value={fields.pairingCode}
        onChange={set('pairingCode')} placeholder="482913" maxLength={32} dir="ltr"
      />
      <Field
        label={t('addSensor.name')} type="text" value={fields.name}
        onChange={set('name')} placeholder={t('addSensor.namePlaceholder')} maxLength={100}
      />
      <Field
        label={t('addSensor.location')} type="text" value={fields.location} onChange={set('location')} maxLength={150}
      />
    </>
  )
}

export default SensorForm

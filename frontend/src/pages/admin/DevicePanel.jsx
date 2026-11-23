import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import Field from '../../components/form/Field'
import { useRequest } from '../../hooks/useRequest'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'
import { formatDateTime, formatPpm } from '../../utils/format'
import { ConfirmBox, PairingCodeBox } from './shared'
import { useAdminOnlyCheck } from './adminUtils'

// The backend's largest admin page, so the owner list shows the first 200
// accounts (oldest first).
const OWNER_LIST_LIMIT = 200
const READINGS_SHOWN = 10

// The accounts a device can be given to, loaded once when the panel opens.
// A failure goes to the panel's error line (setError never changes).
function useOwnerList(setError) {
  const [users, setUsers] = useState(null)
  useEffect(() => {
    api.admin.users({ limit: OWNER_LIST_LIMIT })
      .then((data) => setUsers(data.data))
      .catch(setError)
  }, [setError])
  return users
}

// The state one device's panel shares: the question being asked, and the
// busy flag and error of whichever request runs. act() runs one admin
// request and returns its result (null when it failed); close: false keeps
// the panel open (a new pairing code, the last readings).
function useDevicePanel(onChanged) {
  const showToast = useToast()
  const [confirming, setConfirming] = useState(null)
  const request = useRequest()
  useAdminOnlyCheck(request.error)
  const users = useOwnerList(request.setError)

  async function act(action, message, { close = true } = {}) {
    let result = null
    await request.run(async () => {
      result = await action()
      if (message) showToast(message)
      setConfirming(null)
      if (close) onChanged()
    })
    return result
  }
  return { ...request, users, confirming, setConfirming, act, showToast }
}

// Only the fields that changed are sent. An emptied name or location is
// sent as null, which clears it.
function deviceChanges(device, { name, location, ownerId }, ownerChanged) {
  const data = {}
  if (name.trim() !== (device.name || '')) data.name = name.trim() || null
  if (location.trim() !== (device.location || '')) data.location = location.trim() || null
  if (ownerChanged) data.owner_id = ownerId || null
  return data
}

// The edit form's values. They live in the panel, so they survive while a
// new pairing code is shown in its place.
function useDeviceForm(device) {
  const [values, setValues] = useState({
    name: device.name || '', location: device.location || '', ownerId: device.owner?.id || ''
  })
  const set = (key) => (value) => setValues((current) => ({ ...current, [key]: value }))
  const ownerChanged = values.ownerId !== (device.owner?.id || '')
  return { values, set, ownerChanged, changes: () => deviceChanges(device, values, ownerChanged) }
}

function saveDevice(e, device, form, panel, t) {
  e.preventDefault()
  const data = form.changes()
  if (Object.keys(data).length === 0) {
    panel.showToast(t('admin.users.noChanges'))
    return
  }
  // Taking a device away from its current owner asks first.
  if (form.ownerChanged && device.owner && panel.confirming !== 'owner') {
    panel.setConfirming('owner')
    return
  }
  panel.act(() => api.admin.updateDevice(device.device_id, data), t('admin.devices.saved'))
}

function DeviceForm({ device, form, panel }) {
  const { t } = useLanguage()
  const { values, set } = form
  return (
    <form className="admin-form" onSubmit={(e) => saveDevice(e, device, form, panel, t)} noValidate>
      <Field label={t('addSensor.name')} value={values.name} onChange={set('name')} maxLength={100} />
      <Field label={t('addSensor.location')} value={values.location} onChange={set('location')} maxLength={150} />
      <OwnerSelect value={values.ownerId} onChange={set('ownerId')} users={panel.users} />
      <div className="admin-form-actions">
        <button type="submit" className="btn btn-primary" disabled={panel.busy}>{t('admin.save')}</button>
      </div>
    </form>
  )
}

// Waits for the owner list before it can be changed.
function OwnerSelect({ value, onChange, users }) {
  const { t } = useLanguage()
  return (
    <label className="field">
      {t('admin.devices.owner')}
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={users === null}>
        <option value="">{t('admin.devices.noOwner')}</option>
        {(users || []).map((u) => (
          <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
        ))}
      </select>
    </label>
  )
}

// The three questions this panel can ask, by name.
function deviceQuestions(device, form, panel, t, replaceCode) {
  const id = device.device_id
  const name = device.name || device.mac_display
  return {
    owner: {
      message: t('admin.devices.confirmOwner', { name }), label: t('admin.save'),
      confirm: () => panel.act(() => api.admin.updateDevice(id, form.changes()), t('admin.devices.saved'))
    },
    code: { message: t('admin.devices.confirmCode'), label: t('admin.devices.newCode'), confirm: replaceCode },
    delete: {
      message: t('admin.devices.confirmDelete', { name }), label: t('admin.devices.delete'),
      confirm: () => panel.act(() => api.admin.deleteDevice(id), t('admin.devices.deleted'))
    }
  }
}

// The question being asked, or the action buttons. A new code and the last
// readings keep the panel open.
function DeviceActions({ device, form, panel, onCode, onReadings }) {
  const { t } = useLanguage()
  const id = device.device_id
  const replaceCode = async () => {
    const result = await panel.act(() => api.admin.newPairingCode(id), null, { close: false })
    if (result) onCode(result.pairing_code)
  }
  const showReadings = async () => {
    const result = await panel.act(() => api.admin.readings(id, { limit: READINGS_SHOWN }), null, { close: false })
    if (result) onReadings(result.data)
  }
  const asked = deviceQuestions(device, form, panel, t, replaceCode)[panel.confirming]
  if (asked) {
    return (
      <ConfirmBox
        message={asked.message}
        confirmLabel={asked.label}
        busy={panel.busy}
        onCancel={() => panel.setConfirming(null)}
        onConfirm={asked.confirm}
      />
    )
  }
  return <DangerButtons busy={panel.busy} onAsk={panel.setConfirming} onReadings={showReadings} />
}

function DangerButtons({ busy, onAsk, onReadings }) {
  const { t } = useLanguage()
  return (
    <div className="admin-danger-actions">
      <button type="button" className="btn btn-outline" onClick={onReadings} disabled={busy}>
        {t('admin.devices.showReadings')}
      </button>
      <button type="button" className="btn btn-outline" onClick={() => onAsk('code')}>
        {t('admin.devices.newCode')}
      </button>
      <button type="button" className="btn btn-danger-outline" onClick={() => onAsk('delete')}>
        {t('admin.devices.delete')}
      </button>
    </div>
  )
}

function DeviceReadings({ readings }) {
  const { t, locale } = useLanguage()
  return (
    <div className="admin-subsection">
      <h3>{t('admin.devices.lastReadings', { count: READINGS_SHOWN })}</h3>
      {readings.length === 0 && <p className="admin-muted">{t('history.noReadings')}</p>}
      {readings.length > 0 && (
        <ul className="admin-device-list">
          {readings.map((r) => (
            <li key={r.id}>
              <span className="muted">{formatDateTime(r.reading_time, locale, true)}</span>
              <span className={`strong ${r.alarm_active ? 'danger' : 'safe'}`}>{formatPpm(r.lpg_ppm_est)} ppm</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// One device opened from the devices table: edit it, give it a new pairing
// code, see its last readings or delete it. A new code takes the panel's
// place until Done. One error line serves the whole panel.
function DevicePanel({ device, onChanged }) {
  const { t, errorText } = useLanguage()
  const panel = useDevicePanel(onChanged)
  const form = useDeviceForm(device)
  const [newCode, setNewCode] = useState(null)
  const [readings, setReadings] = useState(null)
  if (newCode) {
    return <PairingCodeBox mac={device.mac_display} code={newCode} onDone={() => setNewCode(null)} />
  }
  return (
    <div className="admin-panel">
      <DeviceForm device={device} form={form} panel={panel} />
      {form.ownerChanged && <p className="field-hint">{t('admin.devices.ownerHint')}</p>}
      <DeviceActions device={device} form={form} panel={panel} onCode={setNewCode} onReadings={setReadings} />
      {readings && <DeviceReadings readings={readings} />}
      {panel.error && <p className="form-error" role="alert">{errorText(panel.error)}</p>}
    </div>
  )
}

export default DevicePanel

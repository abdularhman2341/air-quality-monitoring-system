import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { useApiData } from '../../hooks/useApiData'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'
import { formatDateTime, formatPpm } from '../../utils/format'
import { ConfirmBox, Pager, PairingCodeBox, SearchBar } from './shared'
import { PAGE_SIZE, useAdminOnlyCheck } from './adminUtils'

const OWNER_LIST_LIMIT = 200
const READINGS_SHOWN = 10

function RegisterDevice({ onRegistered }) {
  const { t, errorText } = useLanguage()
  const [mac, setMac] = useState('')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null)
  useAdminOnlyCheck(error)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const result = await api.admin.registerDevice({
        mac_address: mac.trim(),
        name: name.trim() || undefined,
        location: location.trim() || undefined
      })
      setCreated({ mac: result.device.mac_display, code: result.pairing_code })
      setMac('')
      setName('')
      setLocation('')
      onRegistered()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (created) {
    return <PairingCodeBox mac={created.mac} code={created.code} onDone={() => setCreated(null)} />
  }

  return (
    <form className="card admin-register" onSubmit={submit} noValidate>
      <h2>{t('admin.devices.register')}</h2>
      <div className="admin-register-fields">
        <label className="field">
          {t('addSensor.mac')}
          <input
            className="mono-input"
            value={mac}
            onChange={(e) => setMac(e.target.value)}
            placeholder="A4:CF:12:3B:9E:01"
            maxLength={17}
            dir="ltr"
            aria-invalid={error?.code === 'INVALID_MAC' || error?.code === 'DEVICE_EXISTS'}
          />
        </label>
        <label className="field">
          {t('addSensor.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </label>
        <label className="field">
          {t('addSensor.location')}
          <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={150} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy || !mac.trim()}>
          {busy ? t('admin.working') : t('admin.devices.registerSubmit')}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{errorText(error)}</p>}
    </form>
  )
}

function DevicePanel({ device, onChanged }) {
  const { t, locale, errorText } = useLanguage()
  const showToast = useToast()
  const [name, setName] = useState(device.name || '')
  const [location, setLocation] = useState(device.location || '')
  const [ownerId, setOwnerId] = useState(device.owner?.id || '')
  const [users, setUsers] = useState(null)
  const [readings, setReadings] = useState(null)
  const [newCode, setNewCode] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  useAdminOnlyCheck(error)

  useEffect(() => {
    api.admin.users({ limit: OWNER_LIST_LIMIT })
      .then((data) => setUsers(data.data))
      .catch(setError)
  }, [])

  const ownerChanged = ownerId !== (device.owner?.id || '')

  async function run(action, message, { close = true } = {}) {
    setError(null)
    setBusy(true)
    try {
      const result = await action()
      if (message) showToast(message)
      setConfirming(null)
      if (close) onChanged()
      return result
    } catch (err) {
      setError(err)
      return null
    } finally {
      setBusy(false)
    }
  }

  function changes() {
    const data = {}
    if (name.trim() !== (device.name || '')) data.name = name.trim() || null
    if (location.trim() !== (device.location || '')) data.location = location.trim() || null
    if (ownerChanged) data.owner_id = ownerId || null
    return data
  }

  function save(e) {
    e.preventDefault()
    const data = changes()
    if (Object.keys(data).length === 0) {
      showToast(t('admin.users.noChanges'))
      return
    }
    if (ownerChanged && device.owner && confirming !== 'owner') {
      setConfirming('owner')
      return
    }
    run(() => api.admin.updateDevice(device.device_id, data), t('admin.devices.saved'))
  }

  async function replaceCode() {
    const result = await run(() => api.admin.newPairingCode(device.device_id), null, { close: false })
    if (result) setNewCode(result.pairing_code)
  }

  async function showReadings() {
    const result = await run(() => api.admin.readings(device.device_id, { limit: READINGS_SHOWN }), null, { close: false })
    if (result) setReadings(result.data)
  }

  if (newCode) {
    return <PairingCodeBox mac={device.mac_display} code={newCode} onDone={() => setNewCode(null)} />
  }

  return (
    <div className="admin-panel">
      <form className="admin-form" onSubmit={save} noValidate>
        <label className="field">
          {t('addSensor.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </label>
        <label className="field">
          {t('addSensor.location')}
          <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={150} />
        </label>
        <label className="field">
          {t('admin.devices.owner')}
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={users === null}>
            <option value="">{t('admin.devices.noOwner')}</option>
            {(users || []).map((u) => (
              <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
            ))}
          </select>
        </label>
        <div className="admin-form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>{t('admin.save')}</button>
        </div>
      </form>
      {ownerChanged && <p className="field-hint">{t('admin.devices.ownerHint')}</p>}

      {confirming === 'owner' && (
        <ConfirmBox
          message={t('admin.devices.confirmOwner', { name: device.name || device.mac_display })}
          confirmLabel={t('admin.save')}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => run(() => api.admin.updateDevice(device.device_id, changes()), t('admin.devices.saved'))}
        />
      )}
      {confirming === 'code' && (
        <ConfirmBox
          message={t('admin.devices.confirmCode')}
          confirmLabel={t('admin.devices.newCode')}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={replaceCode}
        />
      )}
      {confirming === 'delete' && (
        <ConfirmBox
          message={t('admin.devices.confirmDelete', { name: device.name || device.mac_display })}
          confirmLabel={t('admin.devices.delete')}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => run(() => api.admin.deleteDevice(device.device_id), t('admin.devices.deleted'))}
        />
      )}
      {!confirming && (
        <div className="admin-danger-actions">
          <button type="button" className="btn btn-outline" onClick={showReadings} disabled={busy}>
            {t('admin.devices.showReadings')}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setConfirming('code')}>
            {t('admin.devices.newCode')}
          </button>
          <button type="button" className="btn btn-danger-outline" onClick={() => setConfirming('delete')}>
            {t('admin.devices.delete')}
          </button>
        </div>
      )}

      {readings && (
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
      )}
      {error && <p className="form-error" role="alert">{errorText(error)}</p>}
    </div>
  )
}

function AdminDevices() {
  const { t, locale, errorText } = useLanguage()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [version, setVersion] = useState(0)
  const [open, setOpen] = useState(null)
  const { data, loading, error } = useApiData(
    () => api.admin.devices({ q: query, page, limit: PAGE_SIZE }),
    `${query}|${page}|${version}`
  )
  useAdminOnlyCheck(error)
  const rows = data?.data || []

  function changed() {
    setOpen(null)
    setVersion((v) => v + 1)
  }

  return (
    <>
      <RegisterDevice onRegistered={() => setVersion((v) => v + 1)} />
      <div className="admin-toolbar">
        <SearchBar placeholder={t('admin.devices.search')} onSearch={(q) => { setQuery(q); setPage(1); setOpen(null) }} />
      </div>
      <div className="table-card card">
        {error && <p className="table-message" role="alert">{errorText(error)}</p>}
        {!error && (
          <table>
            <thead>
              <tr>
                <th>{t('history.device')}</th>
                <th>{t('admin.devices.owner')}</th>
                <th>{t('history.status')}</th>
                <th className="num">{t('history.ppm')}</th>
                <th>{t('dashboard.lastReading')}</th>
                <th aria-label={t('admin.manage')} />
              </tr>
            </thead>
            <tbody>
              {rows.map((device) => {
                const isOpen = open === device.device_id
                const online = device.connection_state === 'online'
                return [
                  <tr key={device.device_id} className={isOpen ? 'admin-row-open' : undefined}>
                    <td>
                      <div className="strong">{device.name || '—'}</div>
                      <div className="mono" dir="ltr">{device.mac_display}</div>
                    </td>
                    <td className="muted" dir={device.owner ? 'ltr' : undefined}>
                      {device.owner ? device.owner.email : t('admin.devices.noOwner')}
                    </td>
                    <td>
                      <span className={`chip ${online ? 'chip-safe' : 'chip-neutral'}`}>
                        {online ? t('dashboard.online') : t('dashboard.offlineLabel')}
                      </span>
                    </td>
                    <td className={`num ${device.latest?.alarm_active ? 'danger strong' : ''}`}>
                      {device.latest ? formatPpm(device.latest.lpg_ppm_est) : '—'}
                    </td>
                    <td className="muted">
                      {device.latest ? formatDateTime(device.latest.reading_time, locale) : '—'}
                    </td>
                    <td className="admin-manage-cell">
                      <button
                        type="button"
                        className="btn btn-outline"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : device.device_id)}
                      >
                        {isOpen ? t('admin.close') : t('admin.manage')}
                      </button>
                    </td>
                  </tr>,
                  isOpen && (
                    <tr key={`${device.device_id}-panel`} className="admin-panel-row">
                      <td colSpan={6}><DevicePanel device={device} onChanged={changed} /></td>
                    </tr>
                  )
                ]
              })}
            </tbody>
          </table>
        )}
        {!error && rows.length === 0 && (
          <p className="table-message">{loading ? t('common.loading') : t('admin.devices.none')}</p>
        )}
        <Pager page={page} total={data?.total || 0} onPage={(p) => { setPage(p); setOpen(null) }} />
      </div>
    </>
  )
}

export default AdminDevices

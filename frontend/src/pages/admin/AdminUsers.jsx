import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { useApiData } from '../../hooks/useApiData'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'
import { formatDate } from '../../utils/format'
import { ConfirmBox, Pager, SearchBar } from './shared'
import { PAGE_SIZE, useAdminOnlyCheck } from './adminUtils'

function UserPanel({ user, onChanged }) {
  const { t, errorText } = useLanguage()
  const { user: me, refreshUser } = useAuth()
  const showToast = useToast()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState(user.role)
  const [devices, setDevices] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const isMe = user.id === me.id
  useAdminOnlyCheck(error)

  useEffect(() => {
    api.admin.user(user.id)
      .then((data) => setDevices(data.devices))
      .catch(setError)
  }, [user.id])

  async function run(action, message) {
    setError(null)
    setBusy(true)
    try {
      await action()
      showToast(message)
      setConfirming(null)
      onChanged()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  function save(e) {
    e.preventDefault()
    const changes = {}
    if (name.trim() !== user.name) changes.name = name
    if (email.trim().toLowerCase() !== user.email) changes.email = email
    if (role !== user.role) changes.role = role
    if (Object.keys(changes).length === 0) {
      showToast(t('admin.users.noChanges'))
      return
    }
    run(async () => {
      await api.admin.updateUser(user.id, changes)
      if (isMe) await refreshUser()
    }, t('admin.users.saved'))
  }

  return (
    <div className="admin-panel">
      <form className="admin-form" onSubmit={save} noValidate>
        <label className="field">
          {t('admin.users.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </label>
        <label className="field">
          {t('admin.users.email')}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        </label>
        <label className="field">
          {t('admin.users.role')}
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">{t('admin.role.user')}</option>
            <option value="admin">{t('admin.role.admin')}</option>
          </select>
        </label>
        <div className="admin-form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>{t('admin.save')}</button>
        </div>
      </form>
      {isMe && role === 'user' && user.role === 'admin' && <p className="field-hint">{t('admin.users.demoteSelfHint')}</p>}

      <div className="admin-subsection">
        <h3>{t('admin.users.devices')}</h3>
        {devices === null && !error && <p className="admin-muted">{t('common.loading')}</p>}
        {devices && devices.length === 0 && <p className="admin-muted">{t('admin.users.noDevices')}</p>}
        {devices && devices.length > 0 && (
          <ul className="admin-device-list">
            {devices.map((d) => (
              <li key={d.device_id}>
                <span className="strong">{d.name || '—'}</span>
                <span className="mono" dir="ltr">{d.mac_display}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirming === 'logout' && (
        <ConfirmBox
          message={t(isMe ? 'admin.users.confirmLogoutSelf' : 'admin.users.confirmLogout', { name: user.name })}
          confirmLabel={t('admin.users.logoutAll')}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => run(() => api.admin.logoutUser(user.id), t('admin.users.loggedOut', { name: user.name }))}
        />
      )}
      {confirming === 'reset' && (
        <ConfirmBox
          message={t('admin.users.confirmReset', { email: user.email })}
          confirmLabel={t('admin.users.sendReset')}
          neutral
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => run(() => api.admin.sendPasswordReset(user.id), t('admin.users.resetSent', { name: user.name }))}
        />
      )}
      {confirming === 'delete' && (
        <ConfirmBox
          message={t(isMe ? 'admin.users.confirmDeleteSelf' : 'admin.users.confirmDelete', { name: user.name })}
          confirmLabel={t('admin.users.delete')}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => run(() => api.admin.deleteUser(user.id), t('admin.users.deleted', { name: user.name }))}
        />
      )}
      {!confirming && (
        <div className="admin-danger-actions">
          <button type="button" className="btn btn-outline" onClick={() => setConfirming('reset')}>
            {t('admin.users.sendReset')}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setConfirming('logout')}>
            {t('admin.users.logoutAll')}
          </button>
          <button type="button" className="btn btn-danger-outline" onClick={() => setConfirming('delete')}>
            {t('admin.users.delete')}
          </button>
        </div>
      )}
      {error && <p className="form-error" role="alert">{errorText(error)}</p>}
    </div>
  )
}

function AdminUsers() {
  const { t, locale, errorText } = useLanguage()
  const { user: me } = useAuth()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [version, setVersion] = useState(0)
  const [open, setOpen] = useState(null)
  const { data, loading, error } = useApiData(
    () => api.admin.users({ q: query, page, limit: PAGE_SIZE }),
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
      <div className="admin-toolbar">
        <SearchBar placeholder={t('admin.users.search')} onSearch={(q) => { setQuery(q); setPage(1); setOpen(null) }} />
      </div>
      <div className="table-card card">
        {error && <p className="table-message" role="alert">{errorText(error)}</p>}
        {!error && (
          <table>
            <thead>
              <tr>
                <th>{t('admin.users.name')}</th>
                <th>{t('admin.users.email')}</th>
                <th>{t('admin.users.role')}</th>
                <th className="num">{t('admin.users.deviceCount')}</th>
                <th>{t('admin.users.joined')}</th>
                <th aria-label={t('admin.manage')} />
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isMe={user.id === me.id}
                  open={open === user.id}
                  onToggle={() => setOpen(open === user.id ? null : user.id)}
                  onChanged={changed}
                  locale={locale}
                />
              ))}
            </tbody>
          </table>
        )}
        {!error && rows.length === 0 && (
          <p className="table-message">{loading ? t('common.loading') : t('admin.users.none')}</p>
        )}
        <Pager page={page} total={data?.total || 0} onPage={(p) => { setPage(p); setOpen(null) }} />
      </div>
    </>
  )
}

function UserRow({ user, isMe, open, onToggle, onChanged, locale }) {
  const { t } = useLanguage()
  return (
    <>
      <tr className={open ? 'admin-row-open' : undefined}>
        <td className="strong">
          {user.name}
          {isMe && <span className="admin-you">{t('admin.you')}</span>}
        </td>
        <td className="muted" dir="ltr">{user.email}</td>
        <td>
          <span className={`chip ${user.role === 'admin' ? 'chip-safe' : 'chip-neutral'}`}>{t(`admin.role.${user.role}`)}</span>
        </td>
        <td className="num">{user.device_count}</td>
        <td className="muted">{formatDate(user.created_at, locale)}</td>
        <td className="admin-manage-cell">
          <button type="button" className="btn btn-outline" aria-expanded={open} onClick={onToggle}>
            {open ? t('admin.close') : t('admin.manage')}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="admin-panel-row">
          <td colSpan={6}><UserPanel user={user} onChanged={onChanged} /></td>
        </tr>
      )}
    </>
  )
}

export default AdminUsers

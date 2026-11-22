import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import Field from '../../components/form/Field'
import { useRequest } from '../../hooks/useRequest'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'
import { ConfirmBox } from './shared'
import { useAdminOnlyCheck } from './adminUtils'

// The account actions, in button order. Each asks first (ask, or askSelf on
// your own account) and then sends one request. refresh re-reads your own
// account afterwards; neutral actions delete or end nothing.
const ACTIONS = {
  verify: {
    label: 'admin.users.markVerified', ask: 'admin.users.confirmVerify', done: 'admin.users.verified',
    call: 'verifyUserEmail', neutral: true, refresh: true
  },
  reset: {
    label: 'admin.users.sendReset', ask: 'admin.users.confirmReset', done: 'admin.users.resetSent',
    call: 'sendPasswordReset', neutral: true
  },
  logout: {
    label: 'admin.users.logoutAll', ask: 'admin.users.confirmLogout', askSelf: 'admin.users.confirmLogoutSelf',
    done: 'admin.users.loggedOut', call: 'logoutUser'
  },
  delete: {
    label: 'admin.users.delete', ask: 'admin.users.confirmDelete', askSelf: 'admin.users.confirmDeleteSelf',
    done: 'admin.users.deleted', call: 'deleteUser', danger: true
  }
}

// The account's devices, loaded once when the panel opens. A failure goes
// to the panel's error line (setError is a state setter, so it never changes).
function useUserDevices(userId, setError) {
  const [devices, setDevices] = useState(null)
  useEffect(() => {
    api.admin.user(userId)
      .then((data) => setDevices(data.devices))
      .catch(setError)
  }, [userId, setError])
  return devices
}

// The state one account's panel shares: the question being asked, and the
// busy flag and error of whichever request runs (the device list, a save or
// an action). act() runs a request, then says message, closes the question
// and tells the list to reload.
function useUserPanel(user, onChanged) {
  const { user: me, refreshUser } = useAuth()
  const showToast = useToast()
  const [confirming, setConfirming] = useState(null)
  const request = useRequest()
  // An admin editing their own account: after a change the session's user
  // is re-read, so a self-demotion takes effect on the page at once.
  const isMe = user.id === me.id
  useAdminOnlyCheck(request.error)
  const devices = useUserDevices(user.id, request.setError)

  const act = (action, message) => request.run(async () => {
    await action()
    showToast(message)
    setConfirming(null)
    onChanged()
  })
  const andRefresh = (action) => async () => {
    await action()
    if (isMe) await refreshUser()
  }
  return { ...request, devices, confirming, setConfirming, isMe, act, andRefresh, showToast }
}

// Only the fields that changed are sent, as typed. The email counts as
// changed only if it differs after trimming and lower-casing.
function changedFields(user, { name, email, role }) {
  const changes = {}
  if (name.trim() !== user.name) changes.name = name
  if (email.trim().toLowerCase() !== user.email) changes.email = email
  if (role !== user.role) changes.role = role
  return changes
}

// Saving with nothing changed only says so.
function saveUser(e, user, values, panel, t) {
  e.preventDefault()
  const changes = changedFields(user, values)
  if (Object.keys(changes).length === 0) {
    panel.showToast(t('admin.users.noChanges'))
    return
  }
  panel.act(panel.andRefresh(() => api.admin.updateUser(user.id, changes)), t('admin.users.saved'))
}

function UserForm({ user, panel }) {
  const { t } = useLanguage()
  const [values, setValues] = useState({ name: user.name, email: user.email, role: user.role })
  const set = (key) => (value) => setValues((current) => ({ ...current, [key]: value }))
  const save = (e) => saveUser(e, user, values, panel, t)
  const demotingSelf = panel.isMe && values.role === 'user' && user.role === 'admin'
  return (
    <>
      <form className="admin-form" onSubmit={save} noValidate>
        <UserFields user={user} values={values} set={set} />
        <div className="admin-form-actions">
          <button type="submit" className="btn btn-primary" disabled={panel.busy}>{t('admin.save')}</button>
        </div>
      </form>
      {demotingSelf && <p className="field-hint">{t('admin.users.demoteSelfHint')}</p>}
    </>
  )
}

function UserFields({ user, values, set }) {
  const { t } = useLanguage()
  return (
    <>
      <Field label={t('admin.users.name')} value={values.name} onChange={set('name')} maxLength={100} />
      <Field label={t('admin.users.email')} type="email" value={values.email} onChange={set('email')} dir="ltr">
        {values.email.trim().toLowerCase() !== user.email && (
          <span className="field-hint">{t('admin.users.emailHint')}</span>
        )}
      </Field>
      <label className="field">
        {t('admin.users.role')}
        <select value={values.role} onChange={(e) => set('role')(e.target.value)}>
          <option value="user">{t('admin.role.user')}</option>
          <option value="admin">{t('admin.role.admin')}</option>
        </select>
      </label>
    </>
  )
}

function UserDevices({ devices, error }) {
  const { t } = useLanguage()
  return (
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
  )
}

// The question being asked, or the action buttons. Mark verified shows only
// for an email that is not verified.
function UserActions({ user, panel }) {
  const { t } = useLanguage()
  const names = { name: user.name, email: user.email }
  const asked = ACTIONS[panel.confirming]
  if (asked) {
    const call = () => api.admin[asked.call](user.id)
    return (
      <ConfirmBox
        message={t(panel.isMe && asked.askSelf ? asked.askSelf : asked.ask, names)}
        confirmLabel={t(asked.label)}
        neutral={asked.neutral}
        busy={panel.busy}
        onCancel={() => panel.setConfirming(null)}
        onConfirm={() => panel.act(asked.refresh ? panel.andRefresh(call) : call, t(asked.done, names))}
      />
    )
  }
  return <ActionButtons user={user} onAsk={panel.setConfirming} />
}

function ActionButtons({ user, onAsk }) {
  const { t } = useLanguage()
  const shown = Object.entries(ACTIONS).filter(([key]) => key !== 'verify' || user.email_verified === false)
  return (
    <div className="admin-danger-actions">
      {shown.map(([key, action]) => (
        <button
          key={key}
          type="button"
          className={action.danger ? 'btn btn-danger-outline' : 'btn btn-outline'}
          onClick={() => onAsk(key)}
        >
          {t(action.label)}
        </button>
      ))}
    </div>
  )
}

// One account opened from the users table: edit it, see its devices, and
// the actions on it. One error line serves the whole panel.
function UserPanel({ user, onChanged }) {
  const { errorText } = useLanguage()
  const panel = useUserPanel(user, onChanged)
  return (
    <div className="admin-panel">
      <UserForm user={user} panel={panel} />
      <UserDevices devices={panel.devices} error={panel.error} />
      <UserActions user={user} panel={panel} />
      {panel.error && <p className="form-error" role="alert">{errorText(panel.error)}</p>}
    </div>
  )
}

export default UserPanel

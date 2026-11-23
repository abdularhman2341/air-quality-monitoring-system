import { Fragment, useState } from 'react'
import { api } from '../../api/client'
import { useRequest } from '../../hooks/useRequest'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'
import { formatDateTime, formatDuration, formatPpm } from '../../utils/format'
import { ConfirmBox, TableCard } from './shared'
import { PAGE_SIZE, useAdminList, useAdminOnlyCheck } from './adminUtils'

const REFRESH_MS = 60000

// Ending an alert by hand, with its question first. confirming is the id of
// the alert being asked about; asking clears the last error.
function useCloseAlert(reload) {
  const { t } = useLanguage()
  const showToast = useToast()
  const [confirming, setConfirming] = useState(null)
  const { error, setError, busy, run } = useRequest()
  const close = (alert) => run(async () => {
    await api.admin.closeAlert(alert.id)
    showToast(t('admin.alerts.closed'))
    setConfirming(null)
    reload()
  })
  const ask = (alert) => {
    setError(null)
    setConfirming(alert.id)
  }
  return { confirming, setConfirming, ask, close, busy, error }
}

// Opens on open alerts, because ending an alert that is stuck open (the
// device never sent alarm_off) is the action this page is for.
function AdminAlerts() {
  const { t, errorText } = useLanguage()
  const [status, setStatus] = useState('open')
  const list = useAdminList((page) => api.admin.alerts({ status, page, limit: PAGE_SIZE }), status, REFRESH_MS)
  const closing = useCloseAlert(list.reload)
  useAdminOnlyCheck(list.error || closing.error)
  const showStatus = (value) => {
    setStatus(value)
    list.setPage(1)
    closing.setConfirming(null)
  }
  return (
    <>
      <StatusFilter status={status} onStatus={showStatus} />
      {closing.error && <p className="form-error" role="alert">{errorText(closing.error)}</p>}
      <TableCard
        list={list}
        head={<AlertsHead />}
        empty={t(status === 'open' ? 'admin.alerts.noneOpen' : 'history.noAlerts')}
      >
        {list.rows.map((alert) => <AlertRows key={alert.id} alert={alert} closing={closing} />)}
      </TableCard>
    </>
  )
}

function StatusFilter({ status, onStatus }) {
  const { t } = useLanguage()
  return (
    <div className="admin-toolbar">
      <div className="range-buttons">
        {['open', 'all'].map((value) => (
          <button key={value} type="button" aria-pressed={status === value} onClick={() => onStatus(value)}>
            {t(`admin.alerts.${value}`)}
          </button>
        ))}
      </div>
      <p className="admin-muted">{t('admin.alerts.hint')}</p>
    </div>
  )
}

function AlertsHead() {
  const { t } = useLanguage()
  return (
    <>
      <th>{t('history.device')}</th>
      <th>{t('admin.devices.owner')}</th>
      <th>{t('history.started')}</th>
      <th>{t('history.duration')}</th>
      <th className="num">{t('history.peak')}</th>
      <th>{t('history.status')}</th>
    </>
  )
}

// The alert's row, and under it the question while it is being asked.
function AlertRows({ alert, closing }) {
  const { t } = useLanguage()
  return (
    <Fragment>
      <AlertRow alert={alert} closing={closing} />
      {closing.confirming === alert.id && (
        <tr className="admin-panel-row">
          <td colSpan={6}>
            <ConfirmBox
              message={t('admin.alerts.confirmClose', { name: alert.device?.name || alert.device_id })}
              confirmLabel={t('admin.alerts.close')}
              busy={closing.busy}
              onCancel={() => closing.setConfirming(null)}
              onConfirm={() => closing.close(alert)}
            />
          </td>
        </tr>
      )}
    </Fragment>
  )
}

// An open alert (no ended_at) can be ended; an ended one says so.
function AlertRow({ alert, closing }) {
  const { t, locale } = useLanguage()
  const active = !alert.ended_at
  const owner = alert.device?.owner
  return (
    <tr>
      <td>
        <div className="strong">{alert.device?.name || '—'}</div>
        <div className="mono" dir="ltr">{alert.device_id}</div>
      </td>
      <td className="muted" dir={owner ? 'ltr' : undefined}>{owner ? owner.email : t('admin.devices.noOwner')}</td>
      <td className="muted">{formatDateTime(alert.started_at, locale)}</td>
      <td className="muted">
        {active ? t('history.ongoing') : formatDuration(new Date(alert.ended_at) - new Date(alert.started_at), t)}
      </td>
      <td className={`num strong ${active ? 'danger' : ''}`}>{formatPpm(alert.peak_lpg_ppm_est)}</td>
      <td>
        {active
          ? <CloseButton alert={alert} closing={closing} />
          : <span className="chip chip-neutral">{t('history.ended')}</span>}
      </td>
    </tr>
  )
}

// Disabled while its own question is open.
function CloseButton({ alert, closing }) {
  const { t } = useLanguage()
  return (
    <button
      type="button"
      className="btn btn-danger-outline"
      onClick={() => closing.ask(alert)}
      disabled={closing.confirming === alert.id}
    >
      {t('admin.alerts.close')}
    </button>
  )
}

export default AdminAlerts

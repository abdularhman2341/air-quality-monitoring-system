import { useState } from 'react'
import { api } from '../../api/client'
import { useApiData } from '../../hooks/useApiData'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'
import { formatDateTime, formatDuration, formatPpm } from '../../utils/format'
import { ConfirmBox, Pager } from './shared'
import { PAGE_SIZE, useAdminOnlyCheck } from './adminUtils'

function AdminAlerts() {
  const { t, locale, errorText } = useLanguage()
  const showToast = useToast()
  const [status, setStatus] = useState('open')
  const [page, setPage] = useState(1)
  const [version, setVersion] = useState(0)
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const { data, loading, error } = useApiData(
    () => api.admin.alerts({ status, page, limit: PAGE_SIZE }),
    `${status}|${page}|${version}`,
    60000
  )
  useAdminOnlyCheck(error || actionError)
  const rows = data?.data || []

  async function close(alert) {
    setActionError(null)
    setBusy(true)
    try {
      await api.admin.closeAlert(alert.id)
      showToast(t('admin.alerts.closed'))
      setConfirming(null)
      setVersion((v) => v + 1)
    } catch (err) {
      setActionError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="admin-toolbar">
        <div className="range-buttons">
          {['open', 'all'].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => { setStatus(value); setPage(1); setConfirming(null) }}
            >
              {t(`admin.alerts.${value}`)}
            </button>
          ))}
        </div>
        <p className="admin-muted">{t('admin.alerts.hint')}</p>
      </div>
      {actionError && <p className="form-error" role="alert">{errorText(actionError)}</p>}
      <div className="table-card card">
        {error && <p className="table-message" role="alert">{errorText(error)}</p>}
        {!error && (
          <table>
            <thead>
              <tr>
                <th>{t('history.device')}</th>
                <th>{t('admin.devices.owner')}</th>
                <th>{t('history.started')}</th>
                <th>{t('history.duration')}</th>
                <th className="num">{t('history.peak')}</th>
                <th>{t('history.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((alert) => {
                const active = !alert.ended_at
                return [
                  <tr key={alert.id}>
                    <td>
                      <div className="strong">{alert.device?.name || '—'}</div>
                      <div className="mono" dir="ltr">{alert.device_id}</div>
                    </td>
                    <td className="muted" dir={alert.device?.owner ? 'ltr' : undefined}>
                      {alert.device?.owner ? alert.device.owner.email : t('admin.devices.noOwner')}
                    </td>
                    <td className="muted">{formatDateTime(alert.started_at, locale)}</td>
                    <td className="muted">
                      {active
                        ? t('history.ongoing')
                        : formatDuration(new Date(alert.ended_at) - new Date(alert.started_at), t)}
                    </td>
                    <td className={`num strong ${active ? 'danger' : ''}`}>{formatPpm(alert.peak_lpg_ppm_est)}</td>
                    <td>
                      {active ? (
                        <button
                          type="button"
                          className="btn btn-danger-outline"
                          onClick={() => { setActionError(null); setConfirming(alert.id) }}
                          disabled={confirming === alert.id}
                        >
                          {t('admin.alerts.close')}
                        </button>
                      ) : (
                        <span className="chip chip-neutral">{t('history.ended')}</span>
                      )}
                    </td>
                  </tr>,
                  confirming === alert.id && (
                    <tr key={`${alert.id}-confirm`} className="admin-panel-row">
                      <td colSpan={6}>
                        <ConfirmBox
                          message={t('admin.alerts.confirmClose', { name: alert.device?.name || alert.device_id })}
                          confirmLabel={t('admin.alerts.close')}
                          busy={busy}
                          onCancel={() => setConfirming(null)}
                          onConfirm={() => close(alert)}
                        />
                      </td>
                    </tr>
                  )
                ]
              })}
            </tbody>
          </table>
        )}
        {!error && rows.length === 0 && (
          <p className="table-message">
            {loading ? t('common.loading') : t(status === 'open' ? 'admin.alerts.noneOpen' : 'history.noAlerts')}
          </p>
        )}
        <Pager page={page} total={data?.total || 0} onPage={setPage} />
      </div>
    </>
  )
}

export default AdminAlerts

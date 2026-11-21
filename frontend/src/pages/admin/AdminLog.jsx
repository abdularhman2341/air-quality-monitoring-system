import { useState } from 'react'
import { api } from '../../api/client'
import { useApiData } from '../../hooks/useApiData'
import { useLanguage } from '../../i18n/LanguageContext'
import { formatDateTime } from '../../utils/format'
import { Pager } from './shared'
import { PAGE_SIZE, useAdminOnlyCheck } from './adminUtils'

// Changed fields are stored as { field: { from, to } }; other details
// (for example the owner of a deleted device) are shown as they are.
// Each value is isolated with <bdi>, so an Arabic name next to an email keeps
// its order, and the arrow follows the page direction.
function Details({ details }) {
  const { t, lang } = useLanguage()
  if (!details) {
    return null
  }
  const arrow = lang === 'ar' ? ' ← ' : ' → '
  const parts = Object.entries(details).filter(([field, value]) => !(field === 'history_deleted' && value === false))
  return parts.map(([field, value], index) => (
    <span key={field}>
      {index > 0 && ' · '}
      {field === 'history_deleted' ? t('admin.log.historyDeleted') : (
        <>
          {t(`admin.field.${field}`)}:{' '}
          {value && typeof value === 'object' && 'to' in value
            ? <><bdi>{value.from ?? '—'}</bdi>{arrow}<bdi>{value.to ?? '—'}</bdi></>
            : <bdi>{value ?? '—'}</bdi>}
        </>
      )}
    </span>
  ))
}

function AdminLog() {
  const { t, locale, errorText } = useLanguage()
  const [page, setPage] = useState(1)
  const { data, loading, error } = useApiData(
    () => api.admin.actions({ page, limit: PAGE_SIZE }),
    `${page}`
  )
  useAdminOnlyCheck(error)
  const rows = data?.data || []

  return (
    <div className="table-card card">
      {error && <p className="table-message" role="alert">{errorText(error)}</p>}
      {!error && (
        <table>
          <thead>
            <tr>
              <th>{t('history.time')}</th>
              <th>{t('admin.log.by')}</th>
              <th>{t('admin.log.action')}</th>
              <th>{t('admin.log.target')}</th>
              <th>{t('admin.log.details')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="muted">{formatDateTime(row.created_at, locale, true)}</td>
                <td className="muted" dir={row.admin ? 'ltr' : undefined}>
                  {row.admin ? row.admin.email : t('admin.log.script')}
                </td>
                <td className="strong">{t(`admin.action.${row.action}`)}</td>
                <td>
                  {row.target_label && <div className="strong" dir="auto">{row.target_label}</div>}
                  <div className="mono" dir="ltr">{`${row.target_type} ${row.target_id}`}</div>
                </td>
                <td className="admin-log-details"><Details details={row.details} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!error && rows.length === 0 && (
        <p className="table-message">{loading ? t('common.loading') : t('admin.log.none')}</p>
      )}
      <Pager page={page} total={data?.total || 0} onPage={setPage} />
    </div>
  )
}

export default AdminLog

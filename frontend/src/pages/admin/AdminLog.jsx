import { api } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import { formatDateTime } from '../../utils/format'
import { TableCard } from './shared'
import { PAGE_SIZE, useAdminList, useAdminOnlyCheck } from './adminUtils'

// One changed field: { from, to } shows as from → to (← in Arabic, so the
// arrow follows the page direction); any other value shows as it is. Each
// value is isolated with <bdi>, so an Arabic name next to an email keeps its
// order.
function DetailValue({ value }) {
  const { lang } = useLanguage()
  const arrow = lang === 'ar' ? ' ← ' : ' → '
  if (value && typeof value === 'object' && 'to' in value) {
    return <><bdi>{value.from ?? '—'}</bdi>{arrow}<bdi>{value.to ?? '—'}</bdi></>
  }
  return <bdi>{value ?? '—'}</bdi>
}

// Changed fields are stored as { field: { from, to } }; other details
// (for example the owner of a deleted device) are shown as they are.
// history_deleted shows as a note, and only when it is true.
function Details({ details }) {
  const { t } = useLanguage()
  if (!details) {
    return null
  }
  const parts = Object.entries(details).filter(([field, value]) => !(field === 'history_deleted' && value === false))
  return parts.map(([field, value], index) => (
    <span key={field}>
      {index > 0 && ' · '}
      {field === 'history_deleted' ? t('admin.log.historyDeleted') : (
        <>{t(`admin.field.${field}`)}:{' '}<DetailValue value={value} /></>
      )}
    </span>
  ))
}

function LogRow({ row }) {
  const { t, locale } = useLanguage()
  return (
    <tr>
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
  )
}

// Every admin change, newest first. A null admin means the make-admin script.
function AdminLog() {
  const { t } = useLanguage()
  const list = useAdminList((page) => api.admin.actions({ page, limit: PAGE_SIZE }), '')
  useAdminOnlyCheck(list.error)
  const head = ['history.time', 'admin.log.by', 'admin.log.action', 'admin.log.target', 'admin.log.details']
    .map((key) => <th key={key}>{t(key)}</th>)
  return (
    <TableCard list={list} head={head} empty={t('admin.log.none')}>
      {list.rows.map((row) => <LogRow key={row.id} row={row} />)}
    </TableCard>
  )
}

export default AdminLog

import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import { formatDate } from '../../utils/format'
import { ManageCell, SearchBar, TableCard } from './shared'
import { PAGE_SIZE, usePanelList } from './adminUtils'
import UserPanel from './UserPanel'

const fetchUsers = (q, page) => api.admin.users({ q, page, limit: PAGE_SIZE })

// Every account, searchable by name or email. One account at a time opens
// its panel.
function AdminUsers() {
  const { t } = useLanguage()
  const { user: me } = useAuth()
  const { list, open, toggle, changed, search, turnPage } = usePanelList(fetchUsers)
  return (
    <>
      <div className="admin-toolbar">
        <SearchBar placeholder={t('admin.users.search')} onSearch={search} />
      </div>
      <TableCard list={list} head={<UsersHead />} empty={t('admin.users.none')} onPage={turnPage}>
        {list.rows.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            isMe={user.id === me.id}
            open={open === user.id}
            onToggle={() => toggle(user.id)}
            onChanged={changed}
          />
        ))}
      </TableCard>
    </>
  )
}

function UsersHead() {
  const { t } = useLanguage()
  return (
    <>
      <th>{t('admin.users.name')}</th>
      <th>{t('admin.users.email')}</th>
      <th>{t('admin.users.role')}</th>
      <th className="num">{t('admin.users.deviceCount')}</th>
      <th>{t('admin.users.joined')}</th>
      <th aria-label={t('admin.manage')} />
    </>
  )
}

// The account's row, and under it its panel while it is open.
function UserRow({ user, isMe, open, onToggle, onChanged }) {
  return (
    <>
      <UserSummary user={user} isMe={isMe} open={open} onToggle={onToggle} />
      {open && (
        <tr className="admin-panel-row">
          <td colSpan={6}><UserPanel user={user} onChanged={onChanged} /></td>
        </tr>
      )}
    </>
  )
}

function UserSummary({ user, isMe, open, onToggle }) {
  const { t, locale } = useLanguage()
  return (
    <tr className={open ? 'admin-row-open' : undefined}>
      <td className="strong">
        {user.name}
        {isMe && <span className="admin-you">{t('admin.you')}</span>}
      </td>
      <td className="muted">
        <span dir="ltr">{user.email}</span>
        {user.email_verified === false && (
          <span className="chip chip-warn admin-unverified">{t('admin.users.unverified')}</span>
        )}
      </td>
      <td>
        <span className={`chip ${user.role === 'admin' ? 'chip-safe' : 'chip-neutral'}`}>
          {t(`admin.role.${user.role}`)}
        </span>
      </td>
      <td className="num">{user.device_count}</td>
      <td className="muted">{formatDate(user.created_at, locale)}</td>
      <ManageCell open={open} onToggle={onToggle} />
    </tr>
  )
}

export default AdminUsers

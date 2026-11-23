import { api } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import { formatDateTime, formatPpm } from '../../utils/format'
import { ManageCell, SearchBar, TableCard } from './shared'
import { PAGE_SIZE, usePanelList } from './adminUtils'
import RegisterDevice from './RegisterDevice'
import DevicePanel from './DevicePanel'

const fetchDevices = (q, page) => api.admin.devices({ q, page, limit: PAGE_SIZE })

// Every device, searchable by MAC, name, location or owner email, under the
// form that registers a new one. One device at a time opens its panel.
function AdminDevices() {
  const { t } = useLanguage()
  const { list, open, toggle, changed, search, turnPage } = usePanelList(fetchDevices)
  return (
    <>
      <RegisterDevice onRegistered={list.reload} />
      <div className="admin-toolbar">
        <SearchBar placeholder={t('admin.devices.search')} onSearch={search} />
      </div>
      <TableCard list={list} head={<DevicesHead />} empty={t('admin.devices.none')} onPage={turnPage}>
        {list.rows.map((device) => (
          <DeviceRow
            key={device.device_id}
            device={device}
            open={open === device.device_id}
            onToggle={() => toggle(device.device_id)}
            onChanged={changed}
          />
        ))}
      </TableCard>
    </>
  )
}

function DevicesHead() {
  const { t } = useLanguage()
  return (
    <>
      <th>{t('history.device')}</th>
      <th>{t('admin.devices.owner')}</th>
      <th>{t('history.status')}</th>
      <th className="num">{t('history.ppm')}</th>
      <th>{t('dashboard.lastReading')}</th>
      <th aria-label={t('admin.manage')} />
    </>
  )
}

// The device's row, and under it its panel while it is open.
function DeviceRow({ device, open, onToggle, onChanged }) {
  return (
    <>
      <DeviceSummary device={device} open={open} onToggle={onToggle} />
      {open && (
        <tr className="admin-panel-row">
          <td colSpan={6}><DevicePanel device={device} onChanged={onChanged} /></td>
        </tr>
      )}
    </>
  )
}

function DeviceSummary({ device, open, onToggle }) {
  const { t, locale } = useLanguage()
  const online = device.connection_state === 'online'
  return (
    <tr className={open ? 'admin-row-open' : undefined}>
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
      <td className="muted">{device.latest ? formatDateTime(device.latest.reading_time, locale) : '—'}</td>
      <ManageCell open={open} onToggle={onToggle} />
    </tr>
  )
}

export default AdminDevices

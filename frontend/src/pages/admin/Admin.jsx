import { useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'
import AdminUsers from './AdminUsers'
import AdminDevices from './AdminDevices'
import AdminAlerts from './AdminAlerts'
import AdminLog from './AdminLog'
import '../History.css'
import './Admin.css'

const TABS = {
  users: AdminUsers,
  devices: AdminDevices,
  alerts: AdminAlerts,
  log: AdminLog
}

// Only reachable through AdminRoute. Every request it makes is checked again
// by the backend (requireAdmin), so hiding the page is not the protection.
function Admin() {
  const { t } = useLanguage()
  const [tab, setTab] = useState('users')
  const Tab = TABS[tab]

  return (
    <div className="admin">
      <div className="page-head">
        <div>
          <h1>{t('admin.title')}</h1>
          <p>{t('admin.subtitle')}</p>
        </div>
        <div className="segmented" role="tablist">
          {Object.keys(TABS).map((name) => (
            <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>
              {t(`admin.tab.${name}`)}
            </button>
          ))}
        </div>
      </div>
      <Tab />
    </div>
  )
}

export default Admin

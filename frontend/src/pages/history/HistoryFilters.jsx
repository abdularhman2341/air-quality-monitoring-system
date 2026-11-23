import { useRef } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'
import { TABS, TAB_PANEL_ID, tabForKey, tabId } from './historyTabs'

const RANGES = [
  { days: 1, label: 'history.range24h' },
  { days: 7, label: 'history.range7d' },
  { days: 30, label: 'history.range30d' }
]

// The title and the alerts / readings tabs.
export function HistoryHead({ tab, onTab }) {
  const { t } = useLanguage()
  return (
    <div className="page-head">
      <div>
        <h1>{t('history.title')}</h1>
        <p>{t('history.subtitle')}</p>
      </div>
      <HistoryTabs tab={tab} onTab={onTab} />
    </div>
  )
}

// Only the selected tab is in the Tab order; the arrow keys, Home and End
// select and focus another (F17).
function HistoryTabs({ tab, onTab }) {
  const { t } = useLanguage()
  const buttons = useRef({})
  function onKeyDown(event) {
    const next = tabForKey(event.key, tab)
    if (!next) return
    event.preventDefault()
    onTab(next)
    buttons.current[next].focus()
  }
  return (
    <div className="segmented" role="tablist" onKeyDown={onKeyDown}>
      {TABS.map((name) => (
        <button key={name} type="button" role="tab" id={tabId(name)} aria-controls={TAB_PANEL_ID}
          aria-selected={tab === name} tabIndex={tab === name ? 0 : -1}
          ref={(el) => { buttons.current[name] = el }} onClick={() => onTab(name)}>
          {t(`history.tab.${name}`)}
        </button>
      ))}
    </div>
  )
}

// The device and period filters and the export button. Export is off while
// it runs and when there is nothing to export.
export function HistoryFilters({ query, devices, exporting, onExport }) {
  const { t } = useLanguage()
  return (
    <div className="filters card">
      <DeviceSelect query={query} devices={devices} />
      <RangeButtons days={query.days} onDays={query.setDays} />
      <button type="button" className="btn btn-outline export" onClick={onExport} disabled={exporting || query.total === 0}>
        {exporting ? t('history.exporting') : t('history.export')}
      </button>
    </div>
  )
}

// "All devices" exists on the alerts tab only (see useHistoryQuery).
function DeviceSelect({ query, devices }) {
  const { t } = useLanguage()
  return (
    <label className="filter-device">
      {t('history.device')}
      <select value={query.selectedDevice} onChange={(e) => query.setDeviceFilter(e.target.value)}>
        {query.tab === 'alerts' && <option value="all">{t('history.allDevices')}</option>}
        {devices.map((d) => (
          <option key={d.device_id} value={d.device_id}>{d.name || d.mac_display}</option>
        ))}
      </select>
    </label>
  )
}

// The period buttons; the pressed one is the range on screen.
function RangeButtons({ days, onDays }) {
  const { t } = useLanguage()
  return (
    <div className="filter-range">
      {t('history.range')}
      <div className="range-buttons">
        {RANGES.map((range) => (
          <button key={range.days} type="button" aria-pressed={days === range.days} onClick={() => onDays(range.days)}>
            {t(range.label)}
          </button>
        ))}
      </div>
    </div>
  )
}

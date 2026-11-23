import { useDevices } from '../../hooks/useDevices'
import { useHistoryQuery } from './useHistoryQuery'
import { useCsvExport } from './useCsvExport'
import { HistoryHead, HistoryFilters } from './HistoryFilters'
import ResultsCard from './ResultsCard'
import './History.css'

// A device's name, else its MAC; an id that is no longer in the list (a
// removed device's old alert) shows as the id.
function nameOf(devices, id) {
  const device = devices.find((d) => d.device_id === id)
  return device?.name || device?.mac_display || id
}

// Past alerts and readings of the user's devices, filtered by device and
// period, a page at a time, with a CSV export of the same filters.
function History() {
  const { devices, loading: devicesLoading, error: devicesError } = useDevices(60000)
  const query = useHistoryQuery(devices)
  const deviceName = (id) => nameOf(devices, id)
  const { exporting, exportCsv } = useCsvExport(query, deviceName)

  return (
    <div className="history">
      <HistoryHead tab={query.tab} onTab={query.setTab} />
      <HistoryFilters query={query} devices={devices} exporting={exporting} onExport={exportCsv} />
      <ResultsCard query={query} devices={{ list: devices, loading: devicesLoading, error: devicesError }}
        deviceName={deviceName} />
    </div>
  )
}

export default History

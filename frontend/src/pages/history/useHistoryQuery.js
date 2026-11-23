import { useState } from 'react'
import { api } from '../../api/client'
import { useApiData } from '../../hooks/useApiData'

const REFRESH_MS = 60000
export const PAGE_SIZE = 50

// The range always ends now, so each refresh moves its start forward too.
function since(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

// The page's tab and filters, and the rows they select. Any filter change
// (tab, device, range) goes back to page 1; the pager changes the page only.
// fetchRows asks for the rows of the current filters; the export uses it
// with a bigger page.
export function useHistoryQuery(devices) {
  const [tab, setTab] = useState('alerts')
  const [deviceFilter, setDeviceFilter] = useState('all')
  const [days, setDays] = useState(30)
  const [page, setPage] = useState(1)
  // Readings are fetched per device (the API has no "all devices" readings),
  // so "all" shows the first device on the readings tab. Alerts can be all.
  const readingsDevice = deviceFilter === 'all' ? devices[0]?.device_id : deviceFilter
  const selectedDevice = tab === 'alerts' ? deviceFilter : readingsDevice || ''
  const fetchRows = (params) => (tab === 'alerts'
    ? api.alerts({ device_id: deviceFilter === 'all' ? undefined : deviceFilter, from: since(days), ...params })
    : api.readings(readingsDevice, { from: since(days), ...params }))
  const key = tab === 'alerts' || readingsDevice ? `${tab}|${selectedDevice}|${days}|${page}` : null
  const { data, loading, error } = useApiData(() => fetchRows({ page, limit: PAGE_SIZE }), key, REFRESH_MS)
  const filter = (set) => (value) => {
    set(value)
    setPage(1)
  }
  return {
    tab, days, page, setPage, readingsDevice, selectedDevice, fetchRows, loading, error,
    rows: data?.data || [], total: data?.total || 0,
    setTab: filter(setTab), setDeviceFilter: filter(setDeviceFilter), setDays: filter(setDays)
  }
}

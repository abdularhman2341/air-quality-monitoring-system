import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useApiData } from '../../hooks/useApiData'

export const PAGE_SIZE = 50

// The server says this account is no longer an admin (another admin demoted
// it): re-read the account, so AdminRoute sends it back to the dashboard.
// refreshUser is read through a ref, so the check runs once per new error.
export function useAdminOnlyCheck(error) {
  const { refreshUser } = useAuth()
  const refresh = useRef(refreshUser)

  useEffect(() => {
    refresh.current = refreshUser
  })

  useEffect(() => {
    if (error?.code === 'ADMIN_ONLY') {
      refresh.current()
    }
  }, [error])
}

// One page of an admin list. request(page) asks for that page of the current
// filters; filterKey names those filters, so a new filter loads again.
// version is part of the data key too: reload() raises it so the list is
// fetched again after a change. The caller resets the page on a new filter.
export function useAdminList(request, filterKey, refreshMs) {
  const [page, setPage] = useState(1)
  const [version, setVersion] = useState(0)
  const { data, loading, error } = useApiData(() => request(page), `${filterKey}|${page}|${version}`, refreshMs)
  return {
    page, setPage, loading, error,
    rows: data?.data || [], total: data?.total || 0,
    reload: () => setVersion((v) => v + 1)
  }
}

// A searchable admin list where one row at a time opens its panel.
// request(query, page) asks for one page of the search. A search, a new
// page or a change closes the panel; a change also reloads the list.
export function usePanelList(request) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(null)
  const list = useAdminList((page) => request(query, page), query)
  useAdminOnlyCheck(list.error)
  const changed = () => {
    setOpen(null)
    list.reload()
  }
  const search = (q) => {
    setQuery(q)
    list.setPage(1)
    setOpen(null)
  }
  const turnPage = (p) => {
    list.setPage(p)
    setOpen(null)
  }
  const toggle = (id) => setOpen(open === id ? null : id)
  return { list, open, toggle, changed, search, turnPage }
}

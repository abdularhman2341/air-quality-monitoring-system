import { useEffect, useRef } from 'react'
import { useAuth } from '../../auth/AuthContext'

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

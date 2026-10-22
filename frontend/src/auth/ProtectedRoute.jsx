import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <p>Loading…</p>
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

export function GuestRoute({ children, redirectTo = '/' }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <p>Loading…</p>
  }
  if (user) {
    return <Navigate to={location.state?.from || redirectTo} replace />
  }
  return children
}
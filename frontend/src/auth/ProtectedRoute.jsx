import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useLanguage } from '../i18n/LanguageContext'

export function ProtectedRoute({ children }) {
  const { user, loading, authError } = useAuth()
  const { t, errorText } = useLanguage()
  const location = useLocation()

  if (loading) {
    return <p className="page-loading">{t('common.loading')}</p>
  }
  if (!user && authError) {
    return (
      <div className="page-loading">
        <p role="alert">{errorText(authError)}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          {t('common.retry')}
        </button>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

export function GuestRoute({ children, redirectTo = '/' }) {
  const { user, loading } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()

  if (loading) {
    return <p className="page-loading">{t('common.loading')}</p>
  }
  if (user) {
    return <Navigate to={location.state?.from || redirectTo} replace />
  }
  return children
}

// Inside ProtectedRoute. Hides the admin page from other accounts; the backend
// still checks the role on every admin request (403 ADMIN_ONLY).
export function AdminRoute({ children }) {
  const { user } = useAuth()
  if (user.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return children
}

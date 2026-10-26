import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useLanguage } from '../i18n/LanguageContext'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()

  if (loading) {
    return <p>{t('common.loading')}</p>
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
    return <p>{t('common.loading')}</p>
  }
  if (user) {
    return <Navigate to={location.state?.from || redirectTo} replace />
  }
  return children
}

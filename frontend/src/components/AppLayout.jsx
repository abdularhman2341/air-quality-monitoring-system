import { Outlet } from 'react-router-dom'
import Header from './Header'
import VerifyEmailBanner from './VerifyEmailBanner'
import { useAuth } from '../auth/AuthContext'

function AppLayout() {
  const { user } = useAuth()
  return (
    <>
      <Header />
      {user.email_verified === false && <VerifyEmailBanner />}
      <main className="app-main">
        <Outlet />
      </main>
    </>
  )
}

export default AppLayout

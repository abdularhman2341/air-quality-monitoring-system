import logo from '../assets/logo.svg'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import './Header.css'

function Header() {
  const { user, logout } = useAuth()
  const { t, toggleLanguage } = useLanguage()

  return (
    <header className='header'>
      <div className='brand'>
        <img src={logo} alt="Gas Monitor logo" width="40" />
        <h1>Gas Monitor</h1>
        <p>{t('header.tagline')}</p>
      </div>
      {user && (
        <nav className='nav'>
          <Link to="/">{t('header.dashboard')}</Link>
          <Link to="/add-sensor">{t('header.addSensor')}</Link>
          <Link to="/history">{t('header.history')}</Link>
        </nav>
      )}
      <div className='user'>
        <button onClick={toggleLanguage}>{t('header.switchLanguage')}</button>
        {user && (
          <>
            <Link to="/profile">{user.name}</Link>
            <button onClick={logout}>{t('header.logout')}</button>
          </>
        )}
      </div>
    </header>
  )
}

export default Header

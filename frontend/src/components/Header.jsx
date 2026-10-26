import logo from '../assets/logo.svg'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import './Header.css'

function Header() {
  const { user, logout } = useAuth()
  const { t, lang, setLanguage } = useLanguage()
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase()

  return (
    <header className="header">
      <Link to="/" className="brand">
        <img src={logo} alt="Gas Monitor logo" width="40" height="40" />
        <div>
          <div className="brand-name">Gas Monitor</div>
          <div className="brand-tagline">{t('header.tagline')}</div>
        </div>
      </Link>

      {user && (
        <nav className="nav">
          <NavLink to="/" end className="nav-link">{t('header.dashboard')}</NavLink>
          <NavLink to="/add-sensor" className="nav-link">{t('header.addSensor')}</NavLink>
          <NavLink to="/history" className="nav-link">{t('header.history')}</NavLink>
        </nav>
      )}

      <div className="header-actions">
        <div className="lang-switch" role="group" aria-label={t('header.language')}>
          <button type="button" aria-pressed={lang === 'en'} onClick={() => setLanguage('en')}>EN</button>
          <button type="button" aria-pressed={lang === 'ar'} onClick={() => setLanguage('ar')}>عربي</button>
        </div>
        {user && (
          <>
            <Link to="/profile" className="avatar" title={user.name} aria-label={t('header.profile')}>
              {initial}
            </Link>
            <button type="button" className="btn btn-outline" onClick={logout}>
              {t('header.logout')}
            </button>
          </>
        )}
      </div>
    </header>
  )
}

export default Header

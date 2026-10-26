import logo from '../assets/logo.svg'
import { useLanguage } from '../i18n/LanguageContext'
import LanguageSwitch from './LanguageSwitch'
import './AuthLayout.css'

const FACTS = ['auth.fact1', 'auth.fact2', 'auth.fact3']

function AuthLayout({ children }) {
  const { t } = useLanguage()

  return (
    <div className="auth">
      <aside className="auth-hero">
        <div className="auth-brand">
          <div className="auth-logo">
            <img src={logo} alt="Gas Monitor logo" width="40" height="40" />
          </div>
          <div>
            <div className="auth-brand-name">Gas Monitor</div>
            <div className="auth-brand-tagline">{t('header.tagline')}</div>
          </div>
        </div>
        <div className="auth-pitch">
          <h1>{t('auth.heroTitle')}</h1>
          <p>{t('auth.heroBody')}</p>
        </div>
        <ul className="auth-facts">
          {FACTS.map((key) => (
            <li key={key}><span className="auth-fact-dot" />{t(key)}</li>
          ))}
        </ul>
      </aside>
      <section className="auth-panel">
        <div className="auth-panel-top">
          <LanguageSwitch />
        </div>
        <div className="auth-panel-body">
          <div className="auth-form">{children}</div>
        </div>
      </section>
    </div>
  )
}

export default AuthLayout

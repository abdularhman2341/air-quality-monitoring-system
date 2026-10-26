import { useLanguage } from '../i18n/LanguageContext'

function LanguageSwitch() {
  const { t, lang, setLanguage } = useLanguage()

  return (
    <div className="lang-switch" role="group" aria-label={t('header.language')}>
      <button type="button" aria-pressed={lang === 'en'} onClick={() => setLanguage('en')}>EN</button>
      <button type="button" aria-pressed={lang === 'ar'} onClick={() => setLanguage('ar')}>عربي</button>
    </div>
  )
}

export default LanguageSwitch

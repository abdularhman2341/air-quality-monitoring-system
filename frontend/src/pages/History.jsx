import { useLanguage } from '../i18n/LanguageContext'

function History() {
  const { t } = useLanguage()
  return <h1>{t('history.title')}</h1>
}

export default History

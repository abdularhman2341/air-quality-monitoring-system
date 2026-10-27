import { createContext, useContext, useEffect, useState } from 'react'
import { translations, errorMessages } from './translations'

const STORAGE_KEY = 'aqms_lang'
const LOCALES = { en: 'en-GB', ar: 'ar-u-nu-latn' }

const LanguageContext = createContext(null)

function initialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'ar') {
      return saved
    }
  } catch {
    return 'en'
  }
  return navigator.language.startsWith('ar') ? 'ar' : 'en'
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(initialLanguage)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      return
    }
  }, [lang])

  function t(key, vars = {}) {
    const text = translations[lang][key] ?? translations.en[key] ?? key
    return text.replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match)
  }

  function errorText(err) {
    if (lang === 'en') {
      return err.message
    }
    return errorMessages[lang][err.code] || errorMessages[lang].UNKNOWN_ERROR
  }

  const locale = LOCALES[lang]

  return (
    <LanguageContext.Provider value={{ lang, locale, t, errorText, setLanguage: setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

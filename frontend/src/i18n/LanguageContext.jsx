import { createContext, useContext, useEffect, useState } from 'react'
import { translations, errorMessages } from './translations'

const STORAGE_KEY = 'aqms_lang'
// Locales for dates and times. ar-u-nu-latn is Arabic with 0-9 digits.
const LOCALES = { en: 'en-GB', ar: 'ar-u-nu-latn' }

const LanguageContext = createContext(null)

// The saved choice first, then the browser language, else English.
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

function applyToDocument(lang) {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  return lang
}

// The first language is put on <html> while the first render runs, before
// anything is painted. An effect runs after the first paint, so an Arabic
// page was drawn left to right and then flipped (F16).
function firstLanguage() {
  return applyToDocument(initialLanguage())
}

// Keeps <html lang dir> in step with the language and saves the choice.
function useDocumentLanguage(lang) {
  useEffect(() => {
    applyToDocument(lang)
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      return
    }
  }, [lang])
}

// t() fills {name}-style placeholders from vars. A missing Arabic text falls
// back to English, then to the key itself.
// The backend writes its messages in English, so English shows them as they
// are. Arabic translates by error code; a code with no translation shows
// the general UNKNOWN_ERROR text.
function translator(lang) {
  return {
    t(key, vars = {}) {
      const text = translations[lang][key] ?? translations.en[key] ?? key
      return text.replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match)
    },
    errorText(err) {
      if (lang === 'en') {
        return err.message
      }
      return errorMessages[lang][err.code] || errorMessages[lang].UNKNOWN_ERROR
    },
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(firstLanguage)
  useDocumentLanguage(lang)
  const { t, errorText } = translator(lang)
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

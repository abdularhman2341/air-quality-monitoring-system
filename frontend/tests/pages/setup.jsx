import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../../src/i18n/LanguageContext'
import { ToastProvider } from '../../src/toast/ToastContext'

// Renders a page inside the same providers as main.jsx, minus the real
// AuthProvider: each test file mocks useAuth so no request is sent.
// lang picks the language the way a returning user would have saved it.
export function renderPage(ui, { lang = 'en', route = '/' } = {}) {
  localStorage.setItem('aqms_lang', lang)
  return render(
    <MemoryRouter initialEntries={[route]}>
      <LanguageProvider>
        <ToastProvider>{ui}</ToastProvider>
      </LanguageProvider>
    </MemoryRouter>,
  )
}

// A rejected request the way api/client.js builds one.
export function apiError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status })
}

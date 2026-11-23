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

// The HTML of a node with each element's attributes sorted by name. React
// may write the same attributes in another order after a refactor; the order
// changes nothing in the browser, so the snapshots compare without it.
export function html(node, { outer = false } = {}) {
  const copy = node.cloneNode(true)
  for (const el of [copy, ...copy.querySelectorAll('*')]) {
    const attrs = [...el.attributes].map((a) => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b))
    for (const [name] of attrs) el.removeAttribute(name)
    for (const [name, value] of attrs) el.setAttribute(name, value)
  }
  return outer ? copy.outerHTML : copy.innerHTML
}

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { renderPage, html } from './setup'
import Header from '../../src/components/Header'
import Gauge from '../../src/components/Gauge'
import { LanguageProvider, useLanguage } from '../../src/i18n/LanguageContext'

const auth = vi.hoisted(() => ({ current: null }))
vi.mock('../../src/auth/AuthContext', () => ({ useAuth: () => auth.current }))

afterEach(cleanup)

describe('Header', () => {
  it('renders the same markup for a user and for an admin', () => {
    auth.current = { user: { name: ' sara', role: 'user' }, logout: vi.fn() }
    expect(html(renderPage(<Header />).container)).toMatchSnapshot()
    cleanup()
    auth.current = { user: { name: '', role: 'admin' }, logout: vi.fn() }
    expect(html(renderPage(<Header />, { lang: 'ar' }).container)).toMatchSnapshot()
  })

  it('logs out from its button', () => {
    auth.current = { user: { name: 'Sara', role: 'user' }, logout: vi.fn() }
    renderPage(<Header />)
    fireEvent.click(screen.getByRole('button', { name: 'Log Out' }))
    expect(auth.current.logout).toHaveBeenCalled()
  })
})

describe('Gauge', () => {
  it('draws the same arc for no value, a value and a value past the end', () => {
    for (const value of [null, 0, 420, 99999, -5]) {
      const { container } = render(<Gauge value={value} color="#c00" unitLabel="ppm" thresholdLabel="Alarm at 1000" />)
      expect(html(container)).toMatchSnapshot(`value ${value}`)
      cleanup()
    }
  })
})

function Probe() {
  const { lang, locale, t, errorText, setLanguage } = useLanguage()
  return (
    <div>
      <p data-testid="out">{[lang, locale, t('forgot.resendIn', { seconds: 5 }), t('nope.key'), t('forgot.resendIn'),
        errorText({ code: 'INVALID_CODE', message: 'Bad code' }), errorText({ code: 'NO_SUCH', message: 'x' })].join(' | ')}</p>
      <button onClick={() => setLanguage(lang === 'ar' ? 'en' : 'ar')}>switch</button>
    </div>
  )
}

describe('LanguageProvider', () => {
  beforeEach(() => localStorage.clear())

  it('starts from the saved language, translates, and saves a switch', () => {
    localStorage.setItem('aqms_lang', 'en')
    render(<LanguageProvider><Probe /></LanguageProvider>)
    expect(screen.getByTestId('out').textContent).toMatchSnapshot()
    expect([document.documentElement.lang, document.documentElement.dir]).toEqual(['en', 'ltr'])
    fireEvent.click(screen.getByText('switch'))
    expect(screen.getByTestId('out').textContent).toMatchSnapshot()
    expect([document.documentElement.lang, document.documentElement.dir]).toEqual(['ar', 'rtl'])
    expect(localStorage.getItem('aqms_lang')).toBe('ar')
  })

  it('falls back to the browser language when nothing valid is saved', () => {
    localStorage.setItem('aqms_lang', 'fr')
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('ar-SA')
    render(<LanguageProvider><Probe /></LanguageProvider>)
    expect(screen.getByTestId('out').textContent.startsWith('ar |')).toBe(true)
    vi.restoreAllMocks()
  })

  it('uses English when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    render(<LanguageProvider><Probe /></LanguageProvider>)
    expect(screen.getByTestId('out').textContent.startsWith('en |')).toBe(true)
    vi.restoreAllMocks()
  })
})

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../../src/i18n/LanguageContext'
import { ToastProvider, useToast } from '../../src/toast/ToastContext'

afterEach(cleanup)

// F15: the role="status" box was created together with its text, and screen
// readers announce changes to a live region that is already on the page.
describe('toast live region (F15)', () => {
  function Shout() {
    const showToast = useToast()
    return <button type="button" onClick={() => showToast('Saved.')}>go</button>
  }

  it('the status region is on the page, empty, before any toast', () => {
    render(<ToastProvider><Shout /></ToastProvider>)
    const region = screen.getByRole('status')
    expect(region.textContent).toBe('')
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('status')).toBe(region)
    expect(region.textContent).toBe('Saved.')
    expect(region.querySelector('.toast').textContent).toBe('Saved.')
  })

  it('the empty region draws no toast box', () => {
    const { container } = render(<ToastProvider><Shout /></ToastProvider>)
    expect(container.querySelector('.toast')).toBe(null)
  })
})

// F16: <html> got its lang and dir in an effect, after the first paint, so
// an Arabic page was first drawn left to right and then flipped.
describe('page direction before the first paint (F16)', () => {
  let seen
  function Peek() {
    seen = [document.documentElement.lang, document.documentElement.dir]
    return null
  }

  beforeEach(() => {
    document.documentElement.lang = 'en'
    document.documentElement.removeAttribute('dir')
  })

  it('a saved Arabic choice is already rtl when the page first renders', () => {
    localStorage.setItem('aqms_lang', 'ar')
    render(<LanguageProvider><Peek /></LanguageProvider>)
    expect(seen).toEqual(['ar', 'rtl'])
  })

  it('English is ltr from the start', () => {
    localStorage.setItem('aqms_lang', 'en')
    render(<LanguageProvider><Peek /></LanguageProvider>)
    expect(seen).toEqual(['en', 'ltr'])
  })
})

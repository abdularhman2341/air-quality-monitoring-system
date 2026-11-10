import { useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'
import { PAGE_SIZE } from './adminUtils'

// In-page confirmation for actions that cannot be undone (not window.confirm,
// which some browsers block and which cannot be styled or translated).
export function ConfirmBox({ message, confirmLabel, busy, onConfirm, onCancel }) {
  const { t } = useLanguage()
  return (
    <div className="admin-confirm" role="alertdialog" aria-label={message}>
      <p>{message}</p>
      <div className="admin-confirm-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>
          {t('admin.cancel')}
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {busy ? t('admin.working') : confirmLabel}
        </button>
      </div>
    </div>
  )
}

// A pairing code is shown once: the server keeps only its hash.
export function PairingCodeBox({ mac, code, onDone }) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="pairing-box" role="status">
      <div className="pairing-label">{t('admin.devices.codeFor', { mac })}</div>
      <div className="pairing-code" dir="ltr">{code}</div>
      <p>{t('admin.devices.codeOnce')}</p>
      <p>{t('admin.devices.brokerNote')}</p>
      <div className="admin-confirm-actions">
        <button type="button" className="btn btn-outline" onClick={copy}>
          {copied ? t('admin.devices.copied') : t('admin.devices.copy')}
        </button>
        <button type="button" className="btn btn-primary" onClick={onDone}>{t('admin.devices.codeDone')}</button>
      </div>
    </div>
  )
}

export function SearchBar({ placeholder, onSearch }) {
  const { t } = useLanguage()
  const [text, setText] = useState('')

  function submit(e) {
    e.preventDefault()
    onSearch(text.trim())
  }

  return (
    <form className="admin-search" onSubmit={submit} role="search">
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        maxLength={100}
        aria-label={placeholder}
      />
      <button type="submit" className="btn btn-outline">{t('admin.search')}</button>
    </form>
  )
}

export function Pager({ page, total, onPage }) {
  const { t } = useLanguage()
  if (total <= PAGE_SIZE) {
    return null
  }
  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)
  return (
    <div className="pager">
      <span>{t('history.showing', { from, to, total })}</span>
      <button type="button" className="btn btn-outline" disabled={page === 1} onClick={() => onPage(page - 1)}>
        {t('history.previous')}
      </button>
      <button type="button" className="btn btn-outline" disabled={to >= total} onClick={() => onPage(page + 1)}>
        {t('history.next')}
      </button>
    </div>
  )
}

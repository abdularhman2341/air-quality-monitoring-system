import { useLanguage } from '../../i18n/LanguageContext'

// Cancel and submit under a profile form. The submit button shows busyLabel
// while the request runs and is disabled while busy or while disabled is true.
export function FormButtons({ onCancel, busy, disabled, label, busyLabel, danger = false }) {
  const { t } = useLanguage()
  return (
    <div className="profile-actions profile-actions-end">
      <button type="button" className="btn btn-outline" onClick={onCancel}>
        {t('profile.cancel')}
      </button>
      <button type="submit" className={danger ? 'btn btn-danger' : 'btn btn-primary'} disabled={busy || disabled}>
        {busy ? (busyLabel ?? t('profile.saving')) : label}
      </button>
    </div>
  )
}

// A titled section whose form stays closed behind one button until needed,
// so a password is never asked for by surprise.
export function FoldedSection({ title, body, openLabel, open, onOpen, danger = false, children }) {
  const Tag = danger ? 'section' : 'div'
  return (
    <Tag className={danger ? 'danger-zone' : 'profile-section'}>
      <h2>{title}</h2>
      <p>{body}</p>
      {!open ? (
        <button type="button" className={danger ? 'btn btn-danger-outline' : 'btn btn-outline'} onClick={onOpen}>
          {openLabel}
        </button>
      ) : (
        children
      )}
    </Tag>
  )
}

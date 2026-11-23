import { useAuth } from '../../auth/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import Field from '../../components/form/Field'
import FormError from '../../components/form/FormError'
import { FormButtons, FoldedSection } from './parts'
import { usePasswordForm } from './usePasswordForm'

// Two steps: a button first, then the warning and the password. After the
// account is deleted the session is cleared and the protected routes send
// the user to /login, so the button stays disabled after a success.
function DeleteAccount() {
  const { deleteAccount } = useAuth()
  const { t } = useLanguage()
  const form = usePasswordForm((password) => deleteAccount(password), { stayBusy: true, freeOnClose: false })

  return (
    <FoldedSection danger title={t('profile.deleteTitle')} body={t('profile.deleteBody')}
      openLabel={t('profile.deleteAccount')} open={form.open} onOpen={form.openForm}>
      <form className="form profile-subform" onSubmit={form.handleSubmit}>
        <Field label={t('profile.currentPassword')} type="password" value={form.password} onChange={form.setPassword}
          autoComplete="current-password" required autoFocus />
        <FormError error={form.error} />
        <FormButtons danger onCancel={form.close} busy={form.busy} disabled={!form.password}
          label={t('profile.deleteConfirm')} busyLabel={t('profile.deleting')} />
      </form>
    </FoldedSection>
  )
}

export default DeleteAccount

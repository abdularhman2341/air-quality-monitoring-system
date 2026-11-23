import { useAuth } from '../../auth/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import { useToast } from '../../toast/ToastContext'
import Field from '../../components/form/Field'
import FormError from '../../components/form/FormError'
import { FormButtons, FoldedSection } from './parts'
import { usePasswordForm } from './usePasswordForm'

// Ends every session of this account, including any copied token, and keeps
// this device signed in with a new token.
function LogoutAll() {
  const { logoutAll } = useAuth()
  const { t } = useLanguage()
  const showToast = useToast()
  const form = usePasswordForm(async (password, close) => {
    await logoutAll(password)
    close()
    showToast(t('profile.logoutAllDone'))
  })

  return (
    <FoldedSection title={t('profile.logoutAllTitle')} body={t('profile.logoutAllBody')}
      openLabel={t('profile.logoutAll')} open={form.open} onOpen={form.openForm}>
      <form className="form profile-subform" onSubmit={form.handleSubmit}>
        <Field label={t('profile.currentPassword')} type="password" value={form.password} onChange={form.setPassword}
          autoComplete="current-password" required autoFocus />
        <FormError error={form.error} />
        <FormButtons onCancel={form.close} busy={form.busy} disabled={!form.password}
          label={t('profile.logoutAllConfirm')} />
      </form>
    </FoldedSection>
  )
}

export default LogoutAll

import { useLanguage } from '../../i18n/LanguageContext'

// The server error of a form, in the user's language. Nothing when there is none.
function FormError({ error }) {
  const { errorText } = useLanguage()
  if (!error) return null
  return <p className="form-error" role="alert">{errorText(error)}</p>
}

export default FormError

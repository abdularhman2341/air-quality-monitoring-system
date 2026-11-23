// The same rules as the backend (requirePassword in validate.js): at least 8
// characters and at most 72 bytes. Returns a translation key, or null.
export function passwordErrorKey(password, confirm) {
  if (password.length < 8) return 'signup.passwordTooShort'
  if (new TextEncoder().encode(password).length > 72) return 'signup.passwordTooLong'
  if (password !== confirm) return 'signup.passwordMismatch'
  return null
}

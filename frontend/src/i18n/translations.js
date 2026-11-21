import en from './en'
import ar from './ar'
import errorsAr from './errors.ar'

// Text per language, kept in one file each so no file grows past the size
// limit. Everything imports from here, so the shape stays the same.
export const translations = { en, ar }

export const errorMessages = { ar: errorsAr }

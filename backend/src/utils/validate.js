const HttpError = require('../errors/HttpError');

// Request checks for the controllers. Each one returns the clean value or
// throws a 400 VALIDATION_ERROR whose message names the field.

// Only the basic shape (something@something.tld); the real proof that an
// address works is the verification code sent to it.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalid(message) {
  return new HttpError(400, 'VALIDATION_ERROR', message);
}

function requireString(value, field, { min = 1, max = 255 } = {}) {
  if (typeof value !== 'string' || value.trim().length < min) {
    throw invalid(min > 1 ? `${field} must be at least ${min} characters.` : `${field} is required.`);
  }
  if (value.trim().length > max) {
    throw invalid(`${field} must be at most ${max} characters.`);
  }
  return value.trim();
}

// Lower-cased, so the same address always finds the same account.
function requireEmail(value) {
  const email = requireString(value, 'email').toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw invalid('email is not a valid email address.');
  }
  return email;
}

// For a new password. bcrypt only uses the first 72 bytes, so a longer one
// is refused instead of being cut silently. Bytes, not characters: an
// Arabic letter is 2 bytes.
function requirePassword(value) {
  if (typeof value !== 'string' || value.length < 8) {
    throw invalid('password must be at least 8 characters.');
  }
  if (Buffer.byteLength(value, 'utf8') > 72) {
    throw invalid('password must be at most 72 bytes. Arabic letters use 2 bytes each and emoji use 4.');
  }
  return value;
}

// For a password the user already has (sign-in, confirming an action):
// only present and within 72 bytes. The 8-character rule is for new ones.
function requirePasswordInput(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw invalid(`${field} is required.`);
  }
  if (Buffer.byteLength(value, 'utf8') > 72) {
    throw invalid(`${field} must be at most 72 bytes.`);
  }
  return value;
}

// A 6-digit code typed by the user. Spaces are ignored, so "123 456" works.
function requireCode(value) {
  const code = typeof value === 'string' ? value.replace(/\s/g, '') : '';
  if (!/^\d{6}$/.test(code)) {
    throw invalid('code must be 6 digits.');
  }
  return code;
}

function optionalString(value, field, max) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return requireString(value, field, { max });
}

function optionalDate(value, field) {
  if (value === undefined || value === '') {
    return null;
  }
  const date = new Date(value);
  // Prisma sends dates to PostgreSQL with a 4-digit year (0000 to 9999); a
  // JavaScript date goes far beyond, and reached the database as a 500 (B7).
  const year = date.getUTCFullYear();
  if (typeof value !== 'string' || Number.isNaN(date.getTime()) || year < 0 || year > 9999) {
    throw invalid(`${field} must be a valid ISO 8601 date.`);
  }
  return date;
}

// Query-string numbers such as page and limit: digits only, within range,
// or the fallback when missing.
function optionalInt(value, field, { min = 1, max, fallback }) {
  if (value === undefined || value === '') {
    return fallback;
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw invalid(`${field} must be a whole number.`);
  }
  const number = Number(value);
  if (number < min || number > max) {
    throw invalid(`${field} must be between ${min} and ${max}.`);
  }
  return number;
}

module.exports = {
  requireString, requireEmail, requirePassword, requirePasswordInput, requireCode, optionalString, optionalDate, optionalInt, invalid,
};
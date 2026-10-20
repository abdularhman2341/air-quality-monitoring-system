const HttpError = require('../errors/HttpError');

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

function requireEmail(value) {
  const email = requireString(value, 'email').toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw invalid('email is not a valid email address.');
  }
  return email;
}

function requirePassword(value) {
  if (typeof value !== 'string' || value.length < 8) {
    throw invalid('password must be at least 8 characters.');
  }
  if (value.length > 72) {
    throw invalid('password must be at most 72 characters.');
  }
  return value;
}

function optionalString(value, field, max) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return requireString(value, field, { max });
}

module.exports = { requireString, requireEmail, requirePassword, optionalString };
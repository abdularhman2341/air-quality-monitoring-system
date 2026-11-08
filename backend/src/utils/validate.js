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
  if (Buffer.byteLength(value, 'utf8') > 72) {
    throw invalid('password must be at most 72 bytes. Arabic letters use 2 bytes each and emoji use 4.');
  }
  return value;
}

function requirePasswordInput(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw invalid(`${field} is required.`);
  }
  if (Buffer.byteLength(value, 'utf8') > 72) {
    throw invalid(`${field} must be at most 72 bytes.`);
  }
  return value;
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
  if (typeof value !== 'string' || Number.isNaN(date.getTime())) {
    throw invalid(`${field} must be a valid ISO 8601 date.`);
  }
  return date;
}

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
  requireString, requireEmail, requirePassword, requirePasswordInput, optionalString, optionalDate, optionalInt, invalid,
};
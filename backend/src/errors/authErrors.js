const HttpError = require('./HttpError');

// The errors that the sign-in, sign-up and code routes share.

function invalidCode() {
  return new HttpError(400, 'INVALID_CODE', 'The code is wrong or has expired. Ask for a new one.');
}

function tooManyAttempts() {
  return new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Too many attempts. Wait 15 minutes and try again.');
}

function codeRecentlySent() {
  return new HttpError(429, 'CODE_RECENTLY_SENT', 'A code was sent less than a minute ago. Wait a moment before asking again.');
}

// 403, not 401: the password was right, and the frontend signs out on any 401.
function emailNotVerified() {
  return new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Type the code we emailed you to activate your account.');
}

module.exports = {
  invalidCode, tooManyAttempts, codeRecentlySent, emailNotVerified,
};

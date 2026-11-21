const crypto = require('crypto');

// Read once at start-up. A missing or wrong setting stops the server
// straight away, instead of failing later on a request.
const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error('JWT_SECRET is not set. Add it to backend/.env (local) or the service variables (Railway).');
}

// A session ends after this many minutes without a request. It must be more
// than 1: last_used_at is updated at most once a minute (Session.touch), so a
// shorter limit could end a session that is in use.
const sessionIdleMinutes = Number(process.env.SESSION_IDLE_MINUTES || 15);

if (!Number.isFinite(sessionIdleMinutes) || sessionIdleMinutes <= 1) {
  throw new Error('SESSION_IDLE_MINUTES must be a number of minutes greater than 1.');
}

module.exports = {
  jwtSecret: secret,
  tokenExpiry: process.env.JWT_EXPIRES_IN || '24h',
  sessionIdleMinutes,
  bcryptRounds: 10,
  // The key for hashing verification codes (VerificationCode.hashCode),
  // derived from JWT_SECRET so there is no second secret to manage.
  codeSecret: crypto.createHmac('sha256', secret).update('aqms-verification-codes').digest(),
};
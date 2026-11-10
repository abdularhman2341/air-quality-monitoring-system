const crypto = require('crypto');

const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error('JWT_SECRET is not set. Add it to backend/.env (local) or the service variables (Railway).');
}

const sessionIdleMinutes = Number(process.env.SESSION_IDLE_MINUTES || 15);

if (!Number.isFinite(sessionIdleMinutes) || sessionIdleMinutes <= 1) {
  throw new Error('SESSION_IDLE_MINUTES must be a number of minutes greater than 1.');
}

module.exports = {
  jwtSecret: secret,
  tokenExpiry: process.env.JWT_EXPIRES_IN || '24h',
  sessionIdleMinutes,
  bcryptRounds: 10,
  codeSecret: crypto.createHmac('sha256', secret).update('aqms-verification-codes').digest(),
};
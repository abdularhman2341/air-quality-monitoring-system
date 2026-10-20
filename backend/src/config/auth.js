const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error('JWT_SECRET is not set. Add it to backend/.env (local) or the service variables (Railway).');
}

module.exports = {
  jwtSecret: secret,
  tokenExpiry: process.env.JWT_EXPIRES_IN || '24h',
  bcryptRounds: 10,
};
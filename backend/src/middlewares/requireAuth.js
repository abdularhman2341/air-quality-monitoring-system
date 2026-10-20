const HttpError = require('../errors/HttpError');
const authService = require('../services/AuthService');

async function requireAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'MISSING_TOKEN', 'Sign in to continue.');
  }
  const { userId, sessionId } = await authService.verifyToken(token);
  req.userId = userId;
  req.sessionId = sessionId;
  next();
}

module.exports = requireAuth;
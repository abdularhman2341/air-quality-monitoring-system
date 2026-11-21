const HttpError = require('../errors/HttpError');
const authService = require('../services/AuthService');

// Expects "Authorization: Bearer <token>". verifyToken checks the signature
// and that the session is still active, then the route gets req.userId and
// req.sessionId. A thrown error goes to errorHandler (Express 5).
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
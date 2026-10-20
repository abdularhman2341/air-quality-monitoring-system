const HttpError = require('../errors/HttpError');

function requireAuth(req, res, next) {
  next(HttpError.notImplemented('JWT authentication', 'S2-05'));
}

module.exports = requireAuth;

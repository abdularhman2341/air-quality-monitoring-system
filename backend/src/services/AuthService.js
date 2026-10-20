const HttpError = require('../errors/HttpError');

class AuthService {
  generateToken(userId) {
    throw HttpError.notImplemented('AuthService.generateToken()', 'S2-05');
  }

  verifyToken(token) {
    throw HttpError.notImplemented('AuthService.verifyToken()', 'S2-05');
  }
}

module.exports = new AuthService();

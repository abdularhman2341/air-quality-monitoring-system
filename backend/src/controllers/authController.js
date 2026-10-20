const HttpError = require('../errors/HttpError');

async function register(req, res) {
  throw HttpError.notImplemented('POST /auth/register', 'S2-05');
}

async function login(req, res) {
  throw HttpError.notImplemented('POST /auth/login', 'S2-05');
}

async function me(req, res) {
  throw HttpError.notImplemented('GET /auth/me', 'S2-05');
}

module.exports = { register, login, me };

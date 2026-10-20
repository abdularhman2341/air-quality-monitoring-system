const HttpError = require('../errors/HttpError');

async function list(req, res) {
  throw HttpError.notImplemented('GET /alerts', 'S2-07');
}

async function listForDevice(req, res) {
  throw HttpError.notImplemented('GET /devices/:mac/alerts', 'S2-07');
}

module.exports = { list, listForDevice };

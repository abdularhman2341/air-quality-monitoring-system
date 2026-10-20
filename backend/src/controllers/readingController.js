const HttpError = require('../errors/HttpError');

async function list(req, res) {
  throw HttpError.notImplemented('GET /devices/:mac/readings', 'S1-11');
}

async function latest(req, res) {
  throw HttpError.notImplemented('GET /devices/:mac/readings/latest', 'S1-11');
}

module.exports = { list, latest };

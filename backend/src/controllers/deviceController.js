const HttpError = require('../errors/HttpError');

async function list(req, res) {
  throw HttpError.notImplemented('GET /devices', 'S2-06');
}

async function link(req, res) {
  throw HttpError.notImplemented('POST /devices', 'S2-06');
}

async function get(req, res) {
  throw HttpError.notImplemented('GET /devices/:mac', 'S2-06');
}

async function update(req, res) {
  throw HttpError.notImplemented('PATCH /devices/:mac', 'S2-06');
}

async function unlink(req, res) {
  throw HttpError.notImplemented('DELETE /devices/:mac', 'S2-06');
}

module.exports = { list, link, get, update, unlink };

const HttpError = require('../errors/HttpError');

function notFound(req, res, next) {
  next(new HttpError(404, 'ROUTE_NOT_FOUND', `${req.method} ${req.originalUrl} does not exist.`));
}

module.exports = notFound;

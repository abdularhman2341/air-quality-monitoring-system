const HttpError = require('../errors/HttpError');

// An unknown path becomes a 404 in the usual error format (errorHandler).
function notFound(req, res, next) {
  next(new HttpError(404, 'ROUTE_NOT_FOUND', `${req.method} ${req.originalUrl} does not exist.`));
}

module.exports = notFound;

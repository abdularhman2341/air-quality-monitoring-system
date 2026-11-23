const { Prisma } = require('@prisma/client');
const HttpError = require('../errors/HttpError');

// Prisma codes that mean the database cannot be reached right now: P1001
// server unreachable, P1002 connect timeout, P1008 query timeout, P1017
// connection closed, P2024 no free connection in the pool.
// https://www.prisma.io/docs/orm/reference/error-reference
const DB_UNAVAILABLE_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

function isDatabaseUnavailable(err) {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  return err instanceof Prisma.PrismaClientKnownRequestError && DB_UNAVAILABLE_CODES.has(err.code);
}

function databaseUnavailable(req, res) {
  console.error(`Database unavailable: ${req.method} ${req.originalUrl}`);
  res.set('Retry-After', '30');
  return res.status(503).json({
    error: {
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database is unavailable. Try again shortly.',
    },
  });
}

// An HttpError names its own code. Anything else is a client mistake
// (BAD_REQUEST) unless it is a 500.
function errorCode(err, status) {
  if (err instanceof HttpError) {
    return err.code;
  }
  return status === 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
}

// The one place that turns an error into the JSON answer
// { error: { code, message } }. The frontend translates by `code`.
// - Database down: 503 DATABASE_UNAVAILABLE with Retry-After.
// - HttpError: its own status, code and message.
// - Other errors with a status, such as broken JSON from express.json()
//   (400): the code BAD_REQUEST.
// - Anything else: 500 INTERNAL_ERROR, logged in full; the client gets no
//   details.
// `_next` is unused but must stay: Express treats a function with four
// parameters as an error handler.
function errorHandler(err, req, res, _next) {
  if (isDatabaseUnavailable(err)) {
    return databaseUnavailable(req, res);
  }

  const status = err.status || 500;

  if (status === 500) {
    console.error(err);
  }

  res.status(status).json({
    error: {
      code: errorCode(err, status),
      message: status === 500 ? 'Unexpected server error.' : err.message,
    },
  });
}

module.exports = errorHandler;

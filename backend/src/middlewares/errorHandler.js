const { Prisma } = require('@prisma/client');
const HttpError = require('../errors/HttpError');

const DB_UNAVAILABLE_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

function isDatabaseUnavailable(err) {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  return err instanceof Prisma.PrismaClientKnownRequestError && DB_UNAVAILABLE_CODES.has(err.code);
}

function errorHandler(err, req, res, next) {
  if (isDatabaseUnavailable(err)) {
    console.error(`Database unavailable: ${req.method} ${req.originalUrl}`);
    res.set('Retry-After', '30');
    return res.status(503).json({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is unavailable. Try again shortly.',
      },
    });
  }

  const status = err.status || 500;

  if (status === 500) {
    console.error(err);
  }

  let code = 'BAD_REQUEST';
  if (err instanceof HttpError) {
    code = err.code;
  } else if (status === 500) {
    code = 'INTERNAL_ERROR';
  }

  res.status(status).json({
    error: {
      code,
      message: status === 500 ? 'Unexpected server error.' : err.message,
    },
  });
}

module.exports = errorHandler;

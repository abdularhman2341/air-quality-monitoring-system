const HttpError = require('../errors/HttpError');

function errorHandler(err, req, res, next) {
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

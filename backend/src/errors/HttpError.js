// An error that already knows its answer: status, code (stable, used by the
// frontend for translations) and message.
class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = HttpError;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  static notImplemented(feature, task) {
    return new HttpError(501, 'NOT_IMPLEMENTED', `${feature} is planned for ${task}.`);
  }
}

module.exports = HttpError;

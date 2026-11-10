class MailError extends Error {
  constructor(message, { status = null, reason = null } = {}) {
    super(message);
    this.name = 'MailError';
    this.status = status;
    this.reason = reason;
  }
}

module.exports = MailError;

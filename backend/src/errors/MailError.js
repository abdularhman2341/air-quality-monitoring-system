// A failed email. reason says why (invalid_message, timeout, network, or
// Resend's error name), and status is Resend's HTTP status when it answered.
class MailError extends Error {
  constructor(message, { status = null, reason = null } = {}) {
    super(message);
    this.name = 'MailError';
    this.status = status;
    this.reason = reason;
  }
}

module.exports = MailError;

const mailConfig = require('../config/mail');
const MailError = require('../errors/MailError');

// Sends email through the driver chosen in config/mail.js. The app uses the
// shared instance. The class is exported too and takes its config as an
// argument, but nothing in the repo builds a second one today (the tests
// reload the module with other environment variables instead).
class MailService {
  constructor(config = mailConfig) {
    this.config = config;
    this.driver = config.driver;
    this.outbox = [];
  }

  async send({ to, subject, text, html } = {}) {
    for (const [name, value] of Object.entries({ to, subject, text })) {
      if (typeof value !== 'string' || value.trim() === '') {
        throw new MailError(`Cannot send an email without "${name}".`, { reason: 'invalid_message' });
      }
    }

    const message = { from: this.config.from, to, subject, text };
    if (html) message.html = html;

    if (this.driver === 'resend') return this.sendWithResend(message);
    if (this.driver === 'memory') return this.keepInMemory(message);
    return this.printToConsole(message);
  }

  // Sends without making the caller wait. A failure is logged with a fixed
  // label, never the subject or the text: emails with a code have the code
  // in both.
  sendInBackground(to, email, label) {
    this.send({ to, ...email }).catch((err) => {
      console.error(`Mail not sent (${label}): ${err.message}`);
    });
  }

  printToConsole(message) {
    console.log(`MAIL to ${message.to}: ${message.subject}\n${message.text}`);
    return { id: null };
  }

  keepInMemory(message) {
    this.outbox.push(message);
    return { id: `memory-${this.outbox.length}` };
  }

  clearOutbox() {
    this.outbox.length = 0;
  }

  // Resend's HTTP API (POST /emails). Every failure becomes a MailError with
  // a reason: timeout (MAIL_TIMEOUT_MS), network, or Resend's own error name.
  // https://resend.com/docs/api-reference/emails/send-email
  async sendWithResend(message) {
    const response = await this.postToResend(message);
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new MailError(`Resend refused the email (${response.status}): ${body.message || 'no details'}`, {
        status: response.status,
        reason: body.name || 'rejected',
      });
    }

    return { id: body.id || null };
  }

  // The request alone. A timeout or a network failure never reaches the
  // response check in sendWithResend.
  async postToResend(message) {
    try {
      return await fetch(`${this.config.apiUrl}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (err) {
      if (err.name === 'TimeoutError') {
        throw new MailError(`Resend did not answer within ${this.config.timeoutMs} ms.`, { reason: 'timeout' });
      }
      throw new MailError('Could not reach Resend.', { reason: 'network' });
    }
  }
}

module.exports = new MailService();
module.exports.MailService = MailService;

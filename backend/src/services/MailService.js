const mailConfig = require('../config/mail');
const MailError = require('../errors/MailError');

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

  async sendWithResend(message) {
    let response;
    try {
      response = await fetch(`${this.config.apiUrl}/emails`, {
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

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new MailError(`Resend refused the email (${response.status}): ${body.message || 'no details'}`, {
        status: response.status,
        reason: body.name || 'rejected',
      });
    }

    return { id: body.id || null };
  }
}

module.exports = new MailService();
module.exports.MailService = MailService;

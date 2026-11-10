const DRIVERS = ['console', 'memory', 'resend'];

const driver = process.env.MAIL_DRIVER || 'console';

if (!DRIVERS.includes(driver)) {
  throw new Error(`MAIL_DRIVER must be one of: ${DRIVERS.join(', ')}. Got "${driver}".`);
}

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.MAIL_FROM;

if (driver === 'resend' && !apiKey) {
  throw new Error('MAIL_DRIVER is "resend" but RESEND_API_KEY is not set. Add it to backend/.env (local) or the service variables (Railway).');
}

if (driver === 'resend' && !from) {
  throw new Error('MAIL_DRIVER is "resend" but MAIL_FROM is not set. Example: AQMS <onboarding@resend.dev>');
}

const timeoutMs = Number(process.env.MAIL_TIMEOUT_MS || 10000);

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  throw new Error('MAIL_TIMEOUT_MS must be a number of milliseconds greater than 0.');
}

module.exports = {
  driver,
  apiKey,
  from: from || 'AQMS <no-reply@localhost>',
  apiUrl: (process.env.RESEND_API_URL || 'https://api.resend.com').replace(/\/+$/, ''),
  timeoutMs,
};

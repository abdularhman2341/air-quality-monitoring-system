const http = require('http');

const MAIL_ENV = ['MAIL_DRIVER', 'RESEND_API_KEY', 'MAIL_FROM', 'RESEND_API_URL', 'MAIL_TIMEOUT_MS'];
const savedEnv = {};

function loadMailService(env) {
  for (const name of MAIL_ENV) delete process.env[name];
  Object.assign(process.env, env);
  let mailService;
  jest.isolateModules(() => {
    mailService = require('../src/services/MailService');
  });
  return mailService;
}

function startFakeResend(handler) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, headers: req.headers, body: raw ? JSON.parse(raw) : null });
      handler(req, res);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, requests, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

function reply(status, body) {
  return (req, res) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
}

const message = { to: 'sara@example.com', subject: 'Hello', text: 'Plain body' };
let fake;

beforeAll(() => {
  for (const name of MAIL_ENV) savedEnv[name] = process.env[name];
});

afterEach(async () => {
  if (fake) {
    fake.server.closeAllConnections();
    await new Promise((resolve) => fake.server.close(resolve));
    fake = null;
  }
  for (const name of MAIL_ENV) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
  jest.restoreAllMocks();
});

describe('mail settings', () => {
  test('the tests run with the memory driver', () => {
    expect(savedEnv.MAIL_DRIVER).toBe('memory');
  });

  test('the default driver is console', () => {
    expect(loadMailService({}).driver).toBe('console');
  });

  test('an unknown driver stops the server from starting', () => {
    expect(() => loadMailService({ MAIL_DRIVER: 'smtp' })).toThrow(/MAIL_DRIVER must be one of/);
  });

  test('resend without an API key stops the server from starting', () => {
    expect(() => loadMailService({ MAIL_DRIVER: 'resend', MAIL_FROM: 'AQMS <a@b.c>' })).toThrow(/RESEND_API_KEY is not set/);
  });

  test('resend without a sender stops the server from starting', () => {
    expect(() => loadMailService({ MAIL_DRIVER: 'resend', RESEND_API_KEY: 're_test' })).toThrow(/MAIL_FROM is not set/);
  });

  test('a timeout that is not a positive number stops the server from starting', () => {
    expect(() => loadMailService({ MAIL_TIMEOUT_MS: 'soon' })).toThrow(/MAIL_TIMEOUT_MS/);
  });
});

describe('memory driver', () => {
  test('keeps the email so a test can read it', async () => {
    const mailService = loadMailService({ MAIL_DRIVER: 'memory', MAIL_FROM: 'AQMS <a@b.c>' });
    const result = await mailService.send({ ...message, html: '<p>Rich body</p>' });
    expect(result.id).toBe('memory-1');
    expect(mailService.outbox).toEqual([
      { from: 'AQMS <a@b.c>', to: 'sara@example.com', subject: 'Hello', text: 'Plain body', html: '<p>Rich body</p>' },
    ]);
    mailService.clearOutbox();
    expect(mailService.outbox).toEqual([]);
  });

  test.each(['to', 'subject', 'text'])('refuses an email without "%s"', async (field) => {
    const mailService = loadMailService({ MAIL_DRIVER: 'memory' });
    await expect(mailService.send({ ...message, [field]: '  ' })).rejects.toMatchObject({
      name: 'MailError',
      reason: 'invalid_message',
    });
    expect(mailService.outbox).toEqual([]);
  });
});

describe('console driver', () => {
  test('prints the email and sends nothing', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mailService = loadMailService({ MAIL_DRIVER: 'console' });
    const result = await mailService.send(message);
    expect(result).toEqual({ id: null });
    expect(log.mock.calls[0][0]).toContain('sara@example.com');
    expect(log.mock.calls[0][0]).toContain('Plain body');
  });
});

describe('resend driver', () => {
  const env = (url, extra = {}) => ({
    MAIL_DRIVER: 'resend',
    RESEND_API_KEY: 're_secret_key',
    MAIL_FROM: 'AQMS <onboarding@resend.dev>',
    RESEND_API_URL: url,
    ...extra,
  });

  test('posts the email to /emails with the key in the header', async () => {
    fake = await startFakeResend(reply(200, { id: 'abc-123' }));
    const mailService = loadMailService(env(fake.url));

    const result = await mailService.send({ ...message, html: '<p>Rich body</p>' });

    expect(result).toEqual({ id: 'abc-123' });
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0].method).toBe('POST');
    expect(fake.requests[0].url).toBe('/emails');
    expect(fake.requests[0].headers.authorization).toBe('Bearer re_secret_key');
    expect(fake.requests[0].headers['content-type']).toBe('application/json');
    expect(fake.requests[0].body).toEqual({
      from: 'AQMS <onboarding@resend.dev>',
      to: 'sara@example.com',
      subject: 'Hello',
      text: 'Plain body',
      html: '<p>Rich body</p>',
    });
  });

  test('leaves html out when there is none', async () => {
    fake = await startFakeResend(reply(200, { id: 'abc-123' }));
    await loadMailService(env(fake.url)).send(message);
    expect(fake.requests[0].body).not.toHaveProperty('html');
  });

  test('a refused email throws with the status and the reason', async () => {
    fake = await startFakeResend(reply(403, { statusCode: 403, name: 'validation_error', message: 'You can only send testing emails to your own email address.' }));
    const mailService = loadMailService(env(fake.url));

    const error = await mailService.send(message).catch((err) => err);

    expect(error.name).toBe('MailError');
    expect(error.status).toBe(403);
    expect(error.reason).toBe('validation_error');
    expect(error.message).toContain('your own email address');
  });

  test('a server error without a JSON body still throws', async () => {
    fake = await startFakeResend((req, res) => { res.writeHead(500); res.end('oops'); });
    const error = await loadMailService(env(fake.url)).send(message).catch((err) => err);
    expect(error).toMatchObject({ name: 'MailError', status: 500, reason: 'rejected' });
  });

  test('gives up when Resend does not answer in time', async () => {
    fake = await startFakeResend(() => {});
    const mailService = loadMailService(env(fake.url, { MAIL_TIMEOUT_MS: '200' }));

    const started = Date.now();
    const error = await mailService.send(message).catch((err) => err);

    expect(error).toMatchObject({ name: 'MailError', reason: 'timeout' });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  test('throws when Resend cannot be reached', async () => {
    fake = await startFakeResend(reply(200, { id: 'x' }));
    const url = fake.url;
    await new Promise((resolve) => fake.server.close(resolve));
    fake = null;

    const error = await loadMailService(env(url)).send(message).catch((err) => err);
    expect(error).toMatchObject({ name: 'MailError', reason: 'network' });
  });

  test('the API key never appears in an error', async () => {
    fake = await startFakeResend(reply(401, { name: 'invalid_api_key', message: 'API key is invalid' }));
    const error = await loadMailService(env(fake.url)).send(message).catch((err) => err);
    expect(JSON.stringify({ ...error, message: error.message, stack: error.stack })).not.toContain('re_secret_key');
  });
});

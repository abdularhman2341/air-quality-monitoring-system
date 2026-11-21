const {
  api, prisma, resetDatabase, registerDevice,
} = require('./helpers');
const { makeAdmin } = require('../src/scripts/makeAdmin');
const mailService = require('../src/services/MailService');
const VerificationCode = require('../src/models/VerificationCode');

beforeEach(async () => {
  await resetDatabase();
  mailService.clearOutbox();
});
afterEach(() => jest.restoreAllMocks());
afterAll(() => prisma.$disconnect());

const AUTH = '/api/v1/auth';
const EMAIL = 'sara@test.local';
const PASSWORD = 'password123';
const MAC = 'A4CF123B9E01';

const pause = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForMail(count) {
  for (let i = 0; i < 100 && mailService.outbox.length < count; i += 1) {
    await pause(10);
  }
  return mailService.outbox;
}

const codeIn = (mail) => /\b(\d{6})\b/.exec(mail.text)[1];
const wrongCodeFor = (code) => (code === '000000' ? '111111' : '000000');
const lastCode = () => codeIn(mailService.outbox[mailService.outbox.length - 1]);
const rowOf = (email) => prisma.user.findUnique({ where: { email } });
const signupCodes = () => prisma.verificationCode.findMany({ where: { purpose: 'verify_email' } });

const register = (body = {}, ip = '10.0.0.1') => api().post(`${AUTH}/register`).set('x-real-ip', ip)
  .send({ name: 'Sara', email: EMAIL, password: PASSWORD, ...body });
const confirm = (code, email = EMAIL, ip = '10.0.0.1') => api().post(`${AUTH}/register/confirm`)
  .set('x-real-ip', ip).send({ email, code });
const resend = (email = EMAIL, ip = '10.0.0.1') => api().post(`${AUTH}/register/resend`)
  .set('x-real-ip', ip).send({ email });
const login = (password = PASSWORD, email = EMAIL) => api().post(`${AUTH}/login`).send({ email, password });

async function makeCodesOlder(seconds) {
  await prisma.$executeRawUnsafe(`UPDATE verification_codes SET created_at = created_at - interval '${seconds} seconds'`);
}

// Signs up and waits for the code email.
async function startSignup(body) {
  await register(body).expect(202);
  await waitForMail(1);
  return lastCode();
}

describe('signing up', () => {
  test('answers 202 without a token, saves the account inactive and emails a code', async () => {
    const res = await register().expect(202);
    expect(res.body).toEqual({ email: EMAIL });
    const [mail] = await waitForMail(1);
    expect(mail.to).toBe(EMAIL);
    expect((await rowOf(EMAIL)).email_verified_at).toBeNull();
    const [row] = await signupCodes();
    expect(row.code_hash).not.toContain(codeIn(mail));
  });

  test('the account cannot sign in before the code is typed', async () => {
    await startSignup();
    const res = await login().expect(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(res.body).not.toHaveProperty('token');
  });

  test('a wrong password for an inactive account is a normal 401', async () => {
    await startSignup();
    const res = await login('wrong-password').expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('an email that an active account uses is refused', async () => {
    const code = await startSignup();
    await confirm(code).expect(200);
    const res = await register({ email: 'SARA@test.local' }).expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  test('signing up again with an inactive email replaces the name and password', async () => {
    await startSignup();
    await makeCodesOlder(61);
    const code = await startSignup({ name: 'Real Sara', password: 'the-real-one' });
    const res = await confirm(code).expect(200);
    expect(res.body.user.name).toBe('Real Sara');
    await login('the-real-one').expect(200);
    await login(PASSWORD).expect(401);
  });

  test('still answers 202 when the email cannot be sent, and the log does not show the code', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    const send = jest.spyOn(mailService, 'send').mockRejectedValue(new Error('provider down'));
    await register().expect(202);
    await pause();
    const lines = logged.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(lines).toContain('provider down');
    expect(lines).not.toContain(codeIn(send.mock.calls[0][0]));
  });

  test('one address can sign up 10 times in 15 minutes, then 429 with no email', async () => {
    for (let i = 0; i < 10; i += 1) {
      await register({ email: `user${i}@test.local` }).expect(202);
    }
    await waitForMail(10);
    const res = await register({ email: 'one-more@test.local' }).expect(429);
    expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    await pause();
    expect(mailService.outbox).toHaveLength(10);
    await register({ email: 'other@test.local' }, '10.0.0.2').expect(202);
  });
});

describe('typing the code', () => {
  test('the right code activates the account and signs in', async () => {
    const code = await startSignup();
    const res = await confirm(code).expect(200);
    expect(res.body.user).toMatchObject({ email: EMAIL, email_verified: true });
    await api().get(`${AUTH}/me`).set({ Authorization: `Bearer ${res.body.token}` }).expect(200);
    expect(await signupCodes()).toEqual([]);
    await login().expect(200);
  });

  test('accepts the code typed with spaces', async () => {
    const code = await startSignup();
    await confirm(`${code.slice(0, 3)} ${code.slice(3)}`).expect(200);
  });

  test('a wrong code is refused and counted, and after 5 the right one fails', async () => {
    const code = await startSignup();
    for (let i = 0; i < 5; i += 1) {
      const res = await confirm(wrongCodeFor(code)).expect(400);
      expect(res.body.error.code).toBe('INVALID_CODE');
    }
    await confirm(code).expect(400);
    expect((await rowOf(EMAIL)).email_verified_at).toBeNull();
  });

  test('an expired code is refused', async () => {
    const code = await startSignup();
    await prisma.verificationCode.updateMany({ data: { expires_at: new Date(Date.now() - 1000) } });
    await confirm(code).expect(400);
  });

  test('gives the same 400 for an unknown email and for an active account', async () => {
    const code = await startSignup();
    await confirm(code, 'nobody@test.local').expect(400);
    await confirm(code).expect(200);
    const res = await confirm(code).expect(400);
    expect(res.body.error.code).toBe('INVALID_CODE');
  });

  test('a code never signs in an account that is already active', async () => {
    const code = await startSignup();
    await confirm(code).expect(200);
    const row = await rowOf(EMAIL);
    const extra = await VerificationCode.issue(row.id, 'verify_email', { force: true });
    await confirm(extra).expect(400);
  });

  test('activating clears a sign-in lock that wrong passwords caused', async () => {
    const code = await startSignup();
    for (let i = 0; i < 5; i += 1) {
      await login('wrong-password').expect(401);
    }
    await login().expect(429);
    await confirm(code).expect(200);
    await login().expect(200);
  });

  test('a password reset code does not activate the account', async () => {
    await startSignup();
    await api().post(`${AUTH}/forgot-password`).send({ email: EMAIL }).expect(202);
    await waitForMail(2);
    await confirm(lastCode()).expect(400);
  });

  test('one address gets 20 tries in 15 minutes', async () => {
    const code = await startSignup();
    for (let i = 0; i < 20; i += 1) {
      await confirm(wrongCodeFor(code), `x${i}@test.local`).expect(400);
    }
    const res = await confirm(code).expect(429);
    expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    await confirm(code, EMAIL, '10.0.0.2').expect(200);
  });

  test('needs an email and 6 digits', async () => {
    await api().post(`${AUTH}/register/confirm`).send({ email: EMAIL }).expect(400);
    await api().post(`${AUTH}/register/confirm`).send({ code: '123456' }).expect(400);
    await confirm('12345').expect(400);
  });

  test('a sensor can be linked right after, with no other step', async () => {
    await registerDevice(MAC);
    const code = await startSignup();
    const { body } = await confirm(code).expect(200);
    await api().post('/api/v1/devices').set({ Authorization: `Bearer ${body.token}` })
      .send({ mac_address: MAC, pairing_code: 'ABCD-EFGH', name: 'Kitchen' }).expect(201);
  });
});

describe('asking for a new code', () => {
  test('waits a minute, then sends a new code that replaces the old one', async () => {
    const first = await startSignup();
    await resend().expect(204);
    await pause();
    expect(mailService.outbox).toHaveLength(1);
    await makeCodesOlder(61);
    await resend().expect(204);
    await waitForMail(2);
    const second = lastCode();
    if (first !== second) await confirm(first).expect(400);
    await confirm(second).expect(200);
  });

  test('answers 204 and sends nothing for an unknown email or an active account', async () => {
    const code = await startSignup();
    await confirm(code).expect(200);
    await makeCodesOlder(61);
    mailService.clearOutbox();
    await resend().expect(204);
    await resend('nobody@test.local').expect(204);
    await pause();
    expect(mailService.outbox).toEqual([]);
  });

  test('a sign-in with the right password to an inactive account sends a new code', async () => {
    await startSignup();
    await makeCodesOlder(61);
    await login().expect(403);
    await waitForMail(2);
    await confirm(lastCode()).expect(200);
  });
});

describe('accounts after this change', () => {
  test('the old verify-email routes are gone', async () => {
    await api().post(`${AUTH}/verify-email`).send({ code: '123456' }).expect(404);
    await api().post(`${AUTH}/verify-email/resend`).expect(404);
  });

  test('an admin changing a user email ends their sessions; the new email is activated at sign-in', async () => {
    const adminCode = await startSignup({ email: 'admin@test.local' });
    const admin = (await confirm(adminCode, 'admin@test.local').expect(200)).body;
    await makeAdmin('admin@test.local');
    const code = await startSignup();
    const user = (await confirm(code).expect(200)).body;
    await api().patch(`/api/v1/admin/users/${user.user.id}`).set({ Authorization: `Bearer ${admin.token}` })
      .send({ email: 'moved@test.local' }).expect(200);
    await api().get(`${AUTH}/me`).set({ Authorization: `Bearer ${user.token}` }).expect(401);
    await login(PASSWORD, 'moved@test.local').expect(403);
    const [toNew] = (await waitForMail(4)).filter((mail) => mail.to === 'moved@test.local');
    await confirm(codeIn(toNew), 'moved@test.local').expect(200);
  });
});

const {
  api, prisma, resetDatabase, signUp, registerDevice,
} = require('./helpers');
const { makeAdmin } = require('../src/scripts/makeAdmin');
const mailService = require('../src/services/MailService');

beforeEach(async () => {
  await resetDatabase();
  mailService.clearOutbox();
});
afterEach(() => jest.restoreAllMocks());
afterAll(() => prisma.$disconnect());

const AUTH = '/api/v1/auth';
const ADMIN = '/api/v1/admin';
const MAC = 'A4CF123B9E01';

const pause = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

// Emails are sent after the response, so give them a moment to arrive.
async function waitForMail(count) {
  for (let i = 0; i < 100 && mailService.outbox.length < count; i += 1) {
    await pause(10);
  }
  return mailService.outbox;
}

const codeIn = (mail) => /\b(\d{6})\b/.exec(mail.text)[1];
const wrongCodeFor = (code) => (code === '000000' ? '111111' : '000000');
const lastMail = () => mailService.outbox[mailService.outbox.length - 1];
const mailsTo = (email) => mailService.outbox.filter((mail) => mail.to === email);
const rowOf = (user) => prisma.user.findUnique({ where: { email: user.email } });
const codesOf = (purpose) => prisma.verificationCode.findMany({ where: { purpose } });
const login = (email, password) => api().post(`${AUTH}/login`).send({ email, password });
const me = (user) => api().get(`${AUTH}/me`).set(user.auth);

async function makeCodesOlder(seconds) {
  await prisma.$executeRawUnsafe(`UPDATE verification_codes SET created_at = created_at - interval '${seconds} seconds'`);
}

// A new account whose verification email is still in the outbox.
async function newAccount(name) {
  const user = await signUp(name, { verified: false });
  const [mail] = await waitForMail(1);
  return { user, mail, code: codeIn(mail) };
}

const verify = (user, code) => api().post(`${AUTH}/verify-email`).set(user.auth).send({ code });
const resend = (user) => api().post(`${AUTH}/verify-email/resend`).set(user.auth);
const linkDevice = (user) => api().post('/api/v1/devices').set(user.auth)
  .send({ mac_address: MAC, pairing_code: 'ABCD-EFGH', name: 'Kitchen' });

function failingMail() {
  const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
  const send = jest.spyOn(mailService, 'send').mockRejectedValue(new Error('provider down'));
  const lines = () => logged.mock.calls.map((call) => call.join(' ')).join('\n');
  return { send, lines };
}

describe('creating an account', () => {
  test('sends a 6-digit code to the new email and stores only a hash', async () => {
    const res = await api().post(`${AUTH}/register`)
      .send({ name: 'Sara', email: 'sara@test.local', password: 'password123' }).expect(201);
    const [mail] = await waitForMail(1);

    expect(res.body.user).toMatchObject({ email: 'sara@test.local', email_verified: false, pending_email: null });
    expect(mail.to).toBe('sara@test.local');
    const code = codeIn(mail);
    expect(mail.subject).toContain(code);

    const [row] = await codesOf('verify_email');
    expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(code);
    expect(JSON.stringify(res.body)).not.toContain(code);
    expect((row.expires_at - row.created_at) / 60000).toBeCloseTo(15, 1);
  });

  test('the account can sign in and read its data before verifying', async () => {
    const { user } = await newAccount();
    const res = await me(user).expect(200);
    expect(res.body.email_verified).toBe(false);
    await api().get('/api/v1/devices').set(user.auth).expect(200);
    await api().get('/api/v1/alerts').set(user.auth).expect(200);
  });

  test('is still created when the email cannot be sent, and the log does not show the code', async () => {
    const { send, lines } = failingMail();
    await api().post(`${AUTH}/register`)
      .send({ name: 'Sara', email: 'sara@test.local', password: 'password123' }).expect(201);
    await pause();

    const code = codeIn(send.mock.calls[0][0]);
    expect(lines()).toContain('Mail not sent (email verification code): provider down');
    expect(lines()).not.toContain(code);
    await login('sara@test.local', 'password123').expect(200);
  });
});

describe('verifying the email', () => {
  test('the right code verifies the account and is then gone', async () => {
    const { user, code } = await newAccount();
    const res = await verify(user, code).expect(200);

    expect(res.body).toMatchObject({ email: user.email, email_verified: true });
    expect((await me(user).expect(200)).body.email_verified).toBe(true);
    expect((await rowOf(user)).email_verified_at).toBeInstanceOf(Date);
    expect(await codesOf('verify_email')).toEqual([]);
  });

  test('accepts the code typed with spaces', async () => {
    const { user, code } = await newAccount();
    await verify(user, ` ${code.slice(0, 3)} ${code.slice(3)} `).expect(200);
  });

  test('a wrong code is refused and counted', async () => {
    const { user, code } = await newAccount();
    const res = await verify(user, wrongCodeFor(code)).expect(400);
    expect(res.body.error.code).toBe('INVALID_CODE');
    expect((await me(user)).body.email_verified).toBe(false);
    expect((await codesOf('verify_email'))[0].attempts).toBe(1);
  });

  test('after 5 wrong tries the right code no longer works', async () => {
    const { user, code } = await newAccount();
    for (let i = 0; i < 5; i += 1) {
      await verify(user, wrongCodeFor(code)).expect(400);
    }
    await verify(user, code).expect(400);
    expect((await me(user)).body.email_verified).toBe(false);
  });

  test('an expired code is refused', async () => {
    const { user, code } = await newAccount();
    await prisma.verificationCode.updateMany({ data: { expires_at: new Date(Date.now() - 1000) } });
    const res = await verify(user, code).expect(400);
    expect(res.body.error.code).toBe('INVALID_CODE');
  });

  test('the code of one account does not verify another', async () => {
    const sara = await newAccount('Sara');
    const omar = await signUp('Omar', { verified: false });
    await verify(omar, sara.code).expect(400);
    expect((await me(omar)).body.email_verified).toBe(false);
  });

  test('a password reset code does not verify the email', async () => {
    const { user } = await newAccount();
    await api().post(`${AUTH}/forgot-password`).send({ email: user.email }).expect(202);
    const outbox = await waitForMail(2);
    await verify(user, codeIn(outbox[1])).expect(400);
    expect((await me(user)).body.email_verified).toBe(false);
  });

  test('an account that is already verified gets 200 without a code being checked', async () => {
    const { user, code } = await newAccount();
    await verify(user, code).expect(200);
    const again = await verify(user, wrongCodeFor(code)).expect(200);
    expect(again.body.email_verified).toBe(true);
  });

  test('needs 6 digits and a signed-in user', async () => {
    const { user, code } = await newAccount();
    const res = await verify(user, '12345').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect((await codesOf('verify_email'))[0].attempts).toBe(0);
    await api().post(`${AUTH}/verify-email`).send({ code }).expect(401);
  });
});

describe('asking for a new verification code', () => {
  test('waits a minute, then sends a new code that replaces the old one', async () => {
    const { user, code: first } = await newAccount();

    const early = await resend(user).expect(429);
    expect(early.body.error.code).toBe('CODE_RECENTLY_SENT');
    expect(mailService.outbox).toHaveLength(1);

    let second = first;
    while (second === first) {
      await makeCodesOlder(61);
      await resend(user).expect(204);
      second = codeIn(lastMail());
    }
    expect(lastMail().to).toBe(user.email);
    expect(await codesOf('verify_email')).toHaveLength(1);
    await verify(user, first).expect(400);
    await verify(user, second).expect(200);
  });

  test('works after the first code expired', async () => {
    const { user } = await newAccount();
    await prisma.verificationCode.updateMany({ data: { expires_at: new Date(Date.now() - 1000) } });
    await makeCodesOlder(61);
    await resend(user).expect(204);
    await verify(user, codeIn(lastMail())).expect(200);
  });

  test('is refused for an account that is already verified', async () => {
    const user = await signUp();
    const res = await resend(user).expect(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_VERIFIED');
    await pause();
    expect(mailService.outbox).toEqual([]);
  });

  test('tells the user when the email cannot be sent, keeps the code out of the log, and allows another try at once', async () => {
    const { user } = await newAccount();
    await makeCodesOlder(61);
    const { send, lines } = failingMail();

    const res = await resend(user).expect(502);
    expect(res.body.error.code).toBe('MAIL_NOT_SENT');
    const code = codeIn(send.mock.calls[0][0]);
    expect(lines()).toContain('Mail not sent (email verification code): provider down');
    expect(lines()).not.toContain(code);

    jest.restoreAllMocks();
    await resend(user).expect(204);
    await verify(user, codeIn(lastMail())).expect(200);
  });

  test('needs a signed-in user', async () => {
    await api().post(`${AUTH}/verify-email/resend`).expect(401);
  });
});

describe('linking a device', () => {
  test('is refused until the email is verified', async () => {
    await registerDevice(MAC);
    const { user, code } = await newAccount();

    const res = await linkDevice(user).expect(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect((await prisma.device.findUnique({ where: { device_id: MAC } })).owner_id).toBeNull();

    await verify(user, code).expect(200);
    await linkDevice(user).expect(201);
  });

  test('the email check comes before the pairing code, so a guess is not answered', async () => {
    await registerDevice(MAC);
    const { user } = await newAccount();
    const res = await api().post('/api/v1/devices').set(user.auth)
      .send({ mac_address: MAC, pairing_code: 'WRONG-CODE', name: 'Kitchen' }).expect(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });
});

describe('changing the email from the profile', () => {
  const NEW = 'new@test.local';
  const change = (user, email, current_password = user.password) => api()
    .patch(`${AUTH}/me/email`).set(user.auth).send({ email, current_password });
  const confirm = (user, code) => api().post(`${AUTH}/me/email/confirm`).set(user.auth).send({ code });
  const resendChange = (user) => api().post(`${AUTH}/me/email/resend`).set(user.auth);
  const cancel = (user) => api().delete(`${AUTH}/me/email/pending`).set(user.auth);

  async function askToChange(user, email = NEW) {
    const res = await change(user, email).expect(200);
    return { res, code: codeIn(lastMail()) };
  }

  test('keeps the old email and sends a code to the new one only', async () => {
    const user = await signUp();
    const { res } = await askToChange(user, 'NEW@Test.local');

    expect(res.body).toMatchObject({ email: user.email, pending_email: NEW, email_verified: true });
    expect(mailService.outbox).toHaveLength(1);
    expect(lastMail().to).toBe(NEW);
    expect((await codesOf('change_email'))).toHaveLength(1);
    await login(user.email, user.password).expect(200);
    await login(NEW, user.password).expect(401);
  });

  test('the code changes the email, keeps the session and tells the old address', async () => {
    const user = await signUp();
    const { code } = await askToChange(user);

    const res = await confirm(user, code).expect(200);
    expect(res.body).toMatchObject({ email: NEW, pending_email: null, email_verified: true });
    await me(user).expect(200);
    await login(NEW, user.password).expect(200);
    await login(user.email, user.password).expect(401);
    expect(await codesOf('change_email')).toEqual([]);

    const outbox = await waitForMail(2);
    expect(outbox[1].to).toBe(user.email);
    expect(outbox[1].subject).toContain('email was changed');
    expect(outbox[1].text).toContain(NEW);
    expect(outbox[1].text).not.toContain(code);
  });

  test('a wrong current password changes nothing and sends nothing', async () => {
    const user = await signUp();
    const res = await change(user, NEW, 'not-my-password').expect(403);
    expect(res.body.error.code).toBe('WRONG_PASSWORD');
    expect((await rowOf(user)).pending_email).toBeNull();
    await pause();
    expect(mailService.outbox).toEqual([]);
  });

  test('an email that another account uses is refused', async () => {
    const user = await signUp();
    const other = await signUp();
    const res = await change(user, other.email).expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
    expect((await rowOf(user)).pending_email).toBeNull();
    expect(mailService.outbox).toEqual([]);
  });

  test('an email taken while the code was waiting is refused at confirm', async () => {
    const user = await signUp();
    const { code } = await askToChange(user);
    await api().post(`${AUTH}/register`).send({ name: 'Other', email: NEW, password: 'password123' }).expect(201);

    const res = await confirm(user, code).expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
    expect((await me(user)).body.email).toBe(user.email);
  });

  test('two accounts waiting for the same email: the first to confirm gets it', async () => {
    const sara = await signUp('Sara');
    const omar = await signUp('Omar');
    const first = await askToChange(sara);
    const second = await askToChange(omar);

    await confirm(sara, first.code).expect(200);
    await confirm(omar, second.code).expect(409);
    expect((await me(omar)).body.email).toBe(omar.email);
  });

  test('a wrong code is refused, and so is a code when no change is waiting', async () => {
    const user = await signUp();
    const none = await confirm(user, '123456').expect(400);
    expect(none.body.error.code).toBe('INVALID_CODE');

    const { code } = await askToChange(user);
    const wrong = await confirm(user, wrongCodeFor(code)).expect(400);
    expect(wrong.body.error.code).toBe('INVALID_CODE');
    expect((await me(user)).body).toMatchObject({ email: user.email, pending_email: NEW });
    expect((await codesOf('change_email'))[0].attempts).toBe(1);
  });

  test('the verification code of the account does not confirm an email change', async () => {
    const { user, code: verifyCode } = await newAccount();
    await change(user, NEW).expect(200);
    await confirm(user, verifyCode).expect(400);
    expect((await me(user)).body.email).toBe(user.email);
  });

  test('a second address within a minute is refused, so the first code cannot confirm it', async () => {
    const user = await signUp();
    const { code } = await askToChange(user);

    const res = await change(user, 'other@test.local').expect(429);
    expect(res.body.error.code).toBe('CODE_RECENTLY_SENT');
    expect((await rowOf(user)).pending_email).toBe(NEW);
    expect(mailsTo('other@test.local')).toEqual([]);

    await makeCodesOlder(61);
    let second = code;
    while (second === code) {
      await makeCodesOlder(61);
      second = (await askToChange(user, 'other@test.local')).code;
    }
    await confirm(user, code).expect(400);
    expect((await me(user)).body.email).toBe(user.email);
    const done = await confirm(user, second).expect(200);
    expect(done.body.email).toBe('other@test.local');
  });

  test('sending the current email cancels a waiting change without an email', async () => {
    const user = await signUp();
    const { code } = await askToChange(user);
    const res = await change(user, user.email).expect(200);
    expect(res.body.pending_email).toBeNull();
    expect(mailService.outbox).toHaveLength(1);
    await confirm(user, code).expect(400);
  });

  test('cancel drops the waiting change, and its code stops working', async () => {
    const user = await signUp();
    const { code } = await askToChange(user);
    const res = await cancel(user).expect(200);
    expect(res.body).toMatchObject({ email: user.email, pending_email: null });
    await confirm(user, code).expect(400);
    expect((await me(user)).body.email).toBe(user.email);
  });

  test('cancel then a new address within a minute still waits', async () => {
    const user = await signUp();
    await askToChange(user);
    await cancel(user).expect(200);
    await change(user, 'other@test.local').expect(429);
    expect(mailsTo('other@test.local')).toEqual([]);
  });

  test('a new code can be sent to the waiting address after a minute', async () => {
    const user = await signUp();
    const { code: first } = await askToChange(user);
    const early = await resendChange(user).expect(429);
    expect(early.body.error.code).toBe('CODE_RECENTLY_SENT');

    let second = first;
    while (second === first) {
      await makeCodesOlder(61);
      await resendChange(user).expect(204);
      second = codeIn(lastMail());
    }
    expect(lastMail().to).toBe(NEW);
    await confirm(user, first).expect(400);
    await confirm(user, second).expect(200);
  });

  test('a new code is refused when no change is waiting', async () => {
    const user = await signUp();
    const res = await resendChange(user).expect(409);
    expect(res.body.error.code).toBe('NO_PENDING_EMAIL');
    expect(mailService.outbox).toEqual([]);
  });

  test('an unverified account that confirms a new email becomes verified', async () => {
    await registerDevice(MAC);
    const { user } = await newAccount();
    const { code } = await askToChange(user);
    const res = await confirm(user, code).expect(200);
    expect(res.body).toMatchObject({ email: NEW, email_verified: true });
    expect(await codesOf('verify_email')).toEqual([]);
    await linkDevice(user).expect(201);
  });

  test('when the email cannot be sent the change is dropped, and the log does not show the code', async () => {
    const user = await signUp();
    const { send, lines } = failingMail();
    const res = await change(user, NEW).expect(502);
    expect(res.body.error.code).toBe('MAIL_NOT_SENT');
    const code = codeIn(send.mock.calls[0][0]);
    expect(lines()).toContain('Mail not sent (email change code): provider down');
    expect(lines()).not.toContain(code);
    expect((await rowOf(user)).pending_email).toBeNull();

    jest.restoreAllMocks();
    await change(user, NEW).expect(200);
  });

  test('every route needs a signed-in user', async () => {
    await api().patch(`${AUTH}/me/email`).send({ email: NEW, current_password: 'a' }).expect(401);
    await api().post(`${AUTH}/me/email/confirm`).send({ code: '123456' }).expect(401);
    await api().post(`${AUTH}/me/email/resend`).expect(401);
    await api().delete(`${AUTH}/me/email/pending`).expect(401);
  });
});

describe('resetting the password', () => {
  test('with the emailed code also verifies the email', async () => {
    const { user } = await newAccount();
    await api().post(`${AUTH}/forgot-password`).send({ email: user.email }).expect(202);
    const outbox = await waitForMail(2);
    await api().post(`${AUTH}/reset-password`)
      .send({ email: user.email, code: codeIn(outbox[1]), new_password: 'new-password-456' }).expect(204);
    expect((await rowOf(user)).email_verified_at).toBeInstanceOf(Date);
    expect(await codesOf('verify_email')).toEqual([]);
  });
});

describe('admin', () => {
  async function adminAnd(options) {
    const admin = await signUp('Admin');
    await makeAdmin(admin.email);
    const user = await signUp('Sara', options);
    await waitForMail(options && options.verified === false ? 1 : 0);
    return { admin, user, id: (await rowOf(user)).id };
  }
  const markVerified = (admin, id) => api().post(`${ADMIN}/users/${id}/verify-email`).set(admin.auth);
  const lastAction = () => prisma.adminAction.findFirst({ orderBy: { id: 'desc' } });

  test('sees who is verified in the user list', async () => {
    const { admin } = await adminAnd({ verified: false });
    const res = await api().get(`${ADMIN}/users`).set(admin.auth).expect(200);
    expect(res.body.data.map((u) => [u.name, u.email_verified])).toEqual([['Admin', true], ['Sara', false]]);
  });

  test('marks an account as verified, and it is logged', async () => {
    await registerDevice(MAC);
    const { admin, user, id } = await adminAnd({ verified: false });

    const res = await markVerified(admin, id).expect(200);
    expect(res.body).toMatchObject({ email: user.email, email_verified: true });
    expect(await lastAction()).toMatchObject({
      action: 'user.verify_email', admin_email: admin.email, target_id: String(id), target_label: user.email,
    });
    expect(await codesOf('verify_email')).toEqual([]);
    await linkDevice(user).expect(201);
  });

  test('marking a verified account again is refused and not logged', async () => {
    const { admin, id } = await adminAnd();
    const before = await prisma.adminAction.count();
    const res = await markVerified(admin, id).expect(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_VERIFIED');
    expect(await prisma.adminAction.count()).toBe(before);
  });

  test('a normal user cannot mark anyone, and an unknown id is 404', async () => {
    const { admin, user, id } = await adminAnd({ verified: false });
    await markVerified(user, id).expect(403);
    await markVerified(admin, 999999).expect(404);
    expect((await rowOf(user)).email_verified_at).toBeNull();
  });

  test('changing a user email makes it unverified, sends a code to the new address and tells the old one', async () => {
    const { admin, user, id } = await adminAnd();
    await api().patch(`${AUTH}/me/email`).set(user.auth)
      .send({ email: 'waiting@test.local', current_password: user.password }).expect(200);
    mailService.clearOutbox();

    const res = await api().patch(`${ADMIN}/users/${id}`).set(admin.auth).send({ email: 'moved@test.local' }).expect(200);
    expect(res.body).toMatchObject({ email: 'moved@test.local', email_verified: false, pending_email: null });
    expect((await lastAction()).details).toEqual({ email: { from: user.email, to: 'moved@test.local' } });
    expect(await codesOf('change_email')).toEqual([]);

    const outbox = await waitForMail(2);
    const [toNew] = mailsTo('moved@test.local');
    const [toOld] = mailsTo(user.email);
    expect(outbox).toHaveLength(2);
    expect(toOld.subject).toContain('email was changed');
    expect(toOld.text).toContain('moved@test.local');
    expect(JSON.stringify(await lastAction())).not.toContain(codeIn(toNew));

    await verify(user, codeIn(toNew)).expect(200);
    expect((await me(user)).body).toMatchObject({ email: 'moved@test.local', email_verified: true });
  });

  test('editing only the name or role keeps the account verified and sends nothing', async () => {
    const { admin, user, id } = await adminAnd();
    const res = await api().patch(`${ADMIN}/users/${id}`).set(admin.auth)
      .send({ name: 'New Name', email: user.email }).expect(200);
    expect(res.body.email_verified).toBe(true);
    await pause();
    expect(mailService.outbox).toEqual([]);
  });
});

const { api, prisma, resetDatabase, signUp } = require('./helpers');
const { makeAdmin } = require('../src/scripts/makeAdmin');
const mailService = require('../src/services/MailService');
const realtimeGateway = require('../src/services/RealtimeGateway');

beforeEach(async () => {
  await resetDatabase();
  mailService.clearOutbox();
});
afterEach(() => jest.restoreAllMocks());
afterAll(() => prisma.$disconnect());

const AUTH = '/api/v1/auth';
const NEW_PASSWORD = 'new-password-456';

// Emails are sent after the response, so give them a moment to arrive.
async function waitForMail(count) {
  for (let i = 0; i < 100 && mailService.outbox.length < count; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return mailService.outbox;
}

const codeIn = (mail) => /\b(\d{6})\b/.exec(mail.text)[1];

async function askForCode(email) {
  const before = mailService.outbox.length;
  await api().post(`${AUTH}/forgot-password`).send({ email }).expect(202);
  const outbox = await waitForMail(before + 1);
  return codeIn(outbox[outbox.length - 1]);
}

const login = (email, password) => api().post(`${AUTH}/login`).send({ email, password });
const reset = (email, code, new_password = NEW_PASSWORD) => api().post(`${AUTH}/reset-password`).send({ email, code, new_password });
const storedCode = () => prisma.verificationCode.findFirst();
const wrongCodeFor = (code) => (code === '000000' ? '111111' : '000000');

async function makeCodeOlder(seconds) {
  await prisma.$executeRawUnsafe(`UPDATE verification_codes SET created_at = created_at - interval '${seconds} seconds'`);
}

describe('asking for a reset code', () => {
  test('sends a 6-digit code to the account email and stores only a hash', async () => {
    const user = await signUp();
    const res = await api().post(`${AUTH}/forgot-password`).send({ email: user.email }).expect(202);
    const [mail] = await waitForMail(1);

    expect(mail.to).toBe(user.email);
    const code = codeIn(mail);
    expect(mail.subject).toContain(code);

    const row = await storedCode();
    expect(row.purpose).toBe('reset_password');
    expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(code);
    expect(JSON.stringify(res.body)).not.toContain(code);
    const minutes = (row.expires_at - row.created_at) / 60000;
    expect(minutes).toBeCloseTo(15, 1);
  });

  test('answers the same for an email with no account, and sends nothing', async () => {
    const user = await signUp();
    const known = await api().post(`${AUTH}/forgot-password`).send({ email: user.email }).expect(202);
    await waitForMail(1);
    mailService.clearOutbox();

    const unknown = await api().post(`${AUTH}/forgot-password`).send({ email: 'nobody@test.local' }).expect(202);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(unknown.body).toEqual(known.body);
    expect(mailService.outbox).toEqual([]);
  });

  test('accepts the email in any letter case', async () => {
    const user = await signUp();
    await api().post(`${AUTH}/forgot-password`).send({ email: user.email.toUpperCase() }).expect(202);
    expect(await waitForMail(1)).toHaveLength(1);
  });

  test('does not send a second code within a minute, then sends a new one that replaces the old', async () => {
    const user = await signUp();
    const first = await askForCode(user.email);

    await api().post(`${AUTH}/forgot-password`).send({ email: user.email }).expect(202);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mailService.outbox).toHaveLength(1);

    await makeCodeOlder(61);
    let second = await askForCode(user.email);
    while (second === first) {
      await makeCodeOlder(61);
      second = await askForCode(user.email);
    }
    expect(await prisma.verificationCode.count()).toBe(1);
    await reset(user.email, first).expect(400);
    await reset(user.email, second).expect(204);
  });

  test('two requests at the same moment send one code', async () => {
    const user = await signUp();
    await Promise.all([1, 2, 3, 4].map(() => api().post(`${AUTH}/forgot-password`).send({ email: user.email }).expect(202)));
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(mailService.outbox).toHaveLength(1);
  });

  test('still answers 202 when the email cannot be sent', async () => {
    const user = await signUp();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(mailService, 'send').mockRejectedValue(new Error('provider down'));
    await api().post(`${AUTH}/forgot-password`).send({ email: user.email }).expect(202);
  });

  test('needs a valid email', async () => {
    const res = await api().post(`${AUTH}/forgot-password`).send({ email: 'not-an-email' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('resetting the password with the code', () => {
  test('sets the new password, ends every session and tells the user by email', async () => {
    const user = await signUp();
    const second = await login(user.email, user.password).expect(200);
    const disconnect = jest.spyOn(realtimeGateway, 'disconnectUser');
    const code = await askForCode(user.email);

    await reset(user.email, code).expect(204);

    await login(user.email, user.password).expect(401);
    await login(user.email, NEW_PASSWORD).expect(200);
    await api().get(`${AUTH}/me`).set(user.auth).expect(401);
    await api().get(`${AUTH}/me`).set({ Authorization: `Bearer ${second.body.token}` }).expect(401);
    const me = await prisma.user.findUnique({ where: { email: user.email } });
    expect(disconnect).toHaveBeenCalledWith(String(me.id));

    const outbox = await waitForMail(2);
    expect(outbox[1].to).toBe(user.email);
    expect(outbox[1].subject).toContain('password was changed');
    expect(outbox[1].text).not.toContain(NEW_PASSWORD);
  });

  test('accepts the code typed with spaces', async () => {
    const user = await signUp();
    const code = await askForCode(user.email);
    await reset(user.email, ` ${code.slice(0, 3)} ${code.slice(3)} `).expect(204);
  });

  test('a code works once', async () => {
    const user = await signUp();
    const code = await askForCode(user.email);
    await reset(user.email, code).expect(204);
    const again = await reset(user.email, code, 'another-password-789').expect(400);
    expect(again.body.error.code).toBe('INVALID_CODE');
    await login(user.email, NEW_PASSWORD).expect(200);
  });

  test('a wrong code is refused and changes nothing', async () => {
    const user = await signUp();
    const code = await askForCode(user.email);
    const res = await reset(user.email, wrongCodeFor(code)).expect(400);
    expect(res.body.error.code).toBe('INVALID_CODE');
    await login(user.email, user.password).expect(200);
    await api().get(`${AUTH}/me`).set(user.auth).expect(200);
    expect((await storedCode()).attempts).toBe(1);
  });

  test('after 5 wrong tries the right code no longer works', async () => {
    const user = await signUp();
    const code = await askForCode(user.email);
    for (let i = 0; i < 5; i += 1) {
      await reset(user.email, wrongCodeFor(code)).expect(400);
    }
    const res = await reset(user.email, code).expect(400);
    expect(res.body.error.code).toBe('INVALID_CODE');
    await login(user.email, user.password).expect(200);
  });

  test('wrong tries sent at the same moment are all counted', async () => {
    const user = await signUp();
    const code = await askForCode(user.email);
    await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(() => reset(user.email, wrongCodeFor(code)).expect(400)));
    expect((await storedCode()).attempts).toBe(5);
    await reset(user.email, code).expect(400);
  });

  test('the same code sent twice at the same moment works once', async () => {
    const user = await signUp();
    const code = await askForCode(user.email);
    const results = await Promise.all([
      reset(user.email, code, 'first-password-111'),
      reset(user.email, code, 'second-password-222'),
    ]);
    expect(results.map((res) => res.status).sort()).toEqual([204, 400]);
  });

  test('an expired code is refused', async () => {
    const user = await signUp();
    const code = await askForCode(user.email);
    await prisma.verificationCode.updateMany({ data: { expires_at: new Date(Date.now() - 1000) } });
    const res = await reset(user.email, code).expect(400);
    expect(res.body.error.code).toBe('INVALID_CODE');
  });

  test('the code of one account does not work for another', async () => {
    const sara = await signUp('Sara');
    const omar = await signUp('Omar');
    const code = await askForCode(sara.email);
    await prisma.$executeRawUnsafe("UPDATE verification_codes SET created_at = now() - interval '2 minutes'");
    await askForCode(omar.email);
    await prisma.verificationCode.updateMany({ data: { attempts: 0 } });

    const saraRow = await prisma.verificationCode.findFirst({ where: { user: { email: sara.email } } });
    await prisma.verificationCode.updateMany({ where: { user: { email: omar.email } }, data: { code_hash: saraRow.code_hash } });

    await reset(omar.email, code).expect(400);
    await login(omar.email, omar.password).expect(200);
  });

  test('gives the same answer for an email with no account', async () => {
    const res = await reset('nobody@test.local', '123456').expect(400);
    expect(res.body.error.code).toBe('INVALID_CODE');
  });

  test('applies the password rules before looking at the code', async () => {
    const user = await signUp();
    const code = await askForCode(user.email);
    const short = await reset(user.email, code, 'short').expect(400);
    expect(short.body.error.code).toBe('VALIDATION_ERROR');
    const long = await reset(user.email, code, 'ع'.repeat(37)).expect(400);
    expect(long.body.error.code).toBe('VALIDATION_ERROR');
    expect((await storedCode()).attempts).toBe(0);
    const badCode = await reset(user.email, '12345').expect(400);
    expect(badCode.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('keeps spaces at the start or end of the new password', async () => {
    const user = await signUp();
    const code = await askForCode(user.email);
    await reset(user.email, code, '  spaced password  ').expect(204);
    await login(user.email, 'spaced password').expect(401);
    await login(user.email, '  spaced password  ').expect(200);
  });
});

describe('changing the password from the profile', () => {
  const change = (user, current_password, new_password = NEW_PASSWORD) => api()
    .patch(`${AUTH}/me/password`).set(user.auth).send({ current_password, new_password });

  test('ends every session, gives this device a new token and sends an email', async () => {
    const user = await signUp();
    const other = await login(user.email, user.password).expect(200);
    const disconnect = jest.spyOn(realtimeGateway, 'disconnectUser');

    const res = await change(user, user.password).expect(200);

    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.token).not.toBe(user.token);
    await api().get(`${AUTH}/me`).set(user.auth).expect(401);
    await api().get(`${AUTH}/me`).set({ Authorization: `Bearer ${other.body.token}` }).expect(401);
    await api().get(`${AUTH}/me`).set({ Authorization: `Bearer ${res.body.token}` }).expect(200);
    await login(user.email, user.password).expect(401);
    await login(user.email, NEW_PASSWORD).expect(200);
    expect(disconnect).toHaveBeenCalledTimes(1);

    const [mail] = await waitForMail(1);
    expect(mail.to).toBe(user.email);
    expect(mail.subject).toContain('password was changed');
  });

  test('a wrong current password returns 403 and changes nothing', async () => {
    const user = await signUp();
    const res = await change(user, 'not-my-password').expect(403);
    expect(res.body.error.code).toBe('WRONG_PASSWORD');
    await api().get(`${AUTH}/me`).set(user.auth).expect(200);
    await login(user.email, user.password).expect(200);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mailService.outbox).toEqual([]);
  });

  test('applies the password rules to the new password', async () => {
    const user = await signUp();
    const res = await change(user, user.password, 'short').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    await login(user.email, user.password).expect(200);
  });

  test('cancels a reset code that was waiting', async () => {
    const user = await signUp();
    const code = await askForCode(user.email);
    await change(user, user.password).expect(200);
    await reset(user.email, code, 'attacker-password-1').expect(400);
    await login(user.email, NEW_PASSWORD).expect(200);
  });

  test('needs a signed-in user', async () => {
    await api().patch(`${AUTH}/me/password`).send({ current_password: 'a', new_password: NEW_PASSWORD }).expect(401);
  });
});

describe('admin sends a reset code', () => {
  async function adminAndUser() {
    const admin = await signUp('Admin');
    await makeAdmin(admin.email);
    const user = await signUp('Sara');
    const row = await prisma.user.findUnique({ where: { email: user.email } });
    return { admin, user, id: row.id };
  }
  const send = (admin, id) => api().post(`/api/v1/admin/users/${id}/password-reset`).set(admin.auth);

  test('emails the user a code that works, and logs it without the code', async () => {
    const { admin, user, id } = await adminAndUser();
    const res = await send(admin, id).expect(204);
    expect(res.body).toEqual({});

    const [mail] = mailService.outbox;
    expect(mail.to).toBe(user.email);
    const code = codeIn(mail);

    const action = await prisma.adminAction.findFirst({ orderBy: { id: 'desc' } });
    expect(action).toMatchObject({ action: 'user.password_reset', admin_email: admin.email, target_label: user.email });
    expect(JSON.stringify(action)).not.toContain(code);

    await api().get('/api/v1/auth/me').set(user.auth).expect(200);
    await reset(user.email, code).expect(204);
    await login(user.email, NEW_PASSWORD).expect(200);
  });

  test('sends a new code even if the user asked a moment ago', async () => {
    const { admin, user, id } = await adminAndUser();
    await askForCode(user.email);
    await send(admin, id).expect(204);
    expect(mailService.outbox).toHaveLength(2);
    await reset(user.email, codeIn(mailService.outbox[1])).expect(204);
  });

  test('tells the admin when the email cannot be sent, and logs nothing', async () => {
    const { admin, id } = await adminAndUser();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(mailService, 'send').mockRejectedValue(new Error('provider down'));
    const before = await prisma.adminAction.count();
    const res = await send(admin, id).expect(502);
    expect(res.body.error.code).toBe('MAIL_NOT_SENT');
    expect(await prisma.adminAction.count()).toBe(before);
  });

  test('refuses a normal user and an unknown id', async () => {
    const { admin, user, id } = await adminAndUser();
    await send(user, id).expect(403);
    await send(admin, 999999).expect(404);
    expect(mailService.outbox).toEqual([]);
  });
});

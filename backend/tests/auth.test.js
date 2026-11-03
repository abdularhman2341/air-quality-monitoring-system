const { api, prisma, resetDatabase, signUp, registerDevice, linkDevice, publish } = require('./helpers');

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('sign-up and sign-in', () => {
  test('rejects a password shorter than 8 characters', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'A', email: 'a@test.local', password: 'short' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects the same email twice, whatever the letter case', async () => {
    const body = { name: 'A', email: 'same@test.local', password: 'password123' };
    await api().post('/api/v1/auth/register').send(body).expect(201);
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ ...body, email: 'SAME@test.local' })
      .expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  test('never returns the password hash', async () => {
    const user = await signUp();
    const res = await api().get('/api/v1/auth/me').set(user.auth).expect(200);
    expect(res.body).not.toHaveProperty('password_hash');
  });

  test('wrong password returns 401', async () => {
    const user = await signUp();
    await api().post('/api/v1/auth/login').send({ email: user.email, password: 'wrong-password' }).expect(401);
  });
});

describe('sessions', () => {
  test('a token stops working after logout', async () => {
    const user = await signUp();
    await api().post('/api/v1/auth/logout').set(user.auth).expect(204);
    const res = await api().get('/api/v1/auth/me').set(user.auth).expect(401);
    expect(res.body.error.code).toBe('SESSION_ENDED');
  });

  test('a request without a token returns 401', async () => {
    await api().get('/api/v1/devices').expect(401);
  });
});

describe('account deletion', () => {
  test('wrong current password returns 403, and the session stays valid', async () => {
    const user = await signUp();
    const res = await api()
      .delete('/api/v1/auth/me')
      .set(user.auth)
      .send({ current_password: 'wrong-password' })
      .expect(403);
    expect(res.body.error.code).toBe('WRONG_PASSWORD');
    await api().get('/api/v1/auth/me').set(user.auth).expect(200);
  });

  test('deletes the account, ends its sessions, and frees its devices with no old data', async () => {
    const user = await signUp();
    const code = await registerDevice('AAAAAAAAAA01');
    await linkDevice(user, 'AAAAAAAAAA01', code);
    await publish('AAAAAAAAAA01', 'readings', {
      lpg_ppm_est: 1200,
      alarm_active: true,
      ts: new Date().toISOString(),
    });

    await api().delete('/api/v1/auth/me').set(user.auth).send({ current_password: user.password }).expect(204);

    await api().get('/api/v1/auth/me').set(user.auth).expect(401);
    expect(await prisma.session.count()).toBe(0);
    const device = await prisma.device.findUnique({ where: { device_id: 'AAAAAAAAAA01' } });
    expect(device.owner_id).toBeNull();
    expect(await prisma.reading.count()).toBe(0);
  });
});

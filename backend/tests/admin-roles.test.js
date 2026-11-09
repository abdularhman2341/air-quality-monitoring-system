const { api, prisma, resetDatabase, signUp } = require('./helpers');
const { makeAdmin } = require('../src/scripts/makeAdmin');

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const ACTIONS = '/api/v1/admin/actions';

async function signUpAdmin(name = 'Admin') {
  const user = await signUp(name);
  await makeAdmin(user.email);
  return user;
}

describe('roles', () => {
  test('a new account is a normal user', async () => {
    const user = await signUp();
    const me = await api().get('/api/v1/auth/me').set(user.auth).expect(200);
    expect(me.body.role).toBe('user');
    const login = await api().post('/api/v1/auth/login').send({ email: user.email, password: user.password }).expect(200);
    expect(login.body.user.role).toBe('user');
  });

  test('the database accepts only user or admin', async () => {
    const user = await signUp();
    await expect(
      prisma.$executeRawUnsafe(`UPDATE users SET role = 'owner' WHERE email = '${user.email}'`),
    ).rejects.toThrow();
  });
});

describe('make-admin script', () => {
  test('promotes an account by email, in any letter case, and logs it', async () => {
    const user = await signUp();
    const result = await makeAdmin(`  ${user.email.toUpperCase()} `);
    expect(result).toBe('promoted');

    const me = await api().get('/api/v1/auth/me').set(user.auth).expect(200);
    expect(me.body.role).toBe('admin');

    const log = await prisma.adminAction.findMany();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      admin_id: null, action: 'user.promote', target_type: 'user', target_id: me.body.id, target_label: user.email,
    });
  });

  test('does nothing for an account that is already an admin', async () => {
    const user = await signUpAdmin();
    expect(await makeAdmin(user.email)).toBe('already_admin');
    expect(await prisma.adminAction.count()).toBe(1);
  });

  test('refuses an email with no account', async () => {
    await expect(makeAdmin('nobody@test.local')).rejects.toThrow('No account uses this email');
    await expect(makeAdmin('not-an-email')).rejects.toThrow();
  });
});

describe('admin-only routes', () => {
  test('need a token', async () => {
    const res = await api().get(ACTIONS).expect(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  test('refuse a normal user with 403', async () => {
    const user = await signUp();
    const res = await api().get(ACTIONS).set(user.auth).expect(403);
    expect(res.body.error.code).toBe('ADMIN_ONLY');
  });

  test('let an admin in', async () => {
    const admin = await signUpAdmin();
    const res = await api().get(ACTIONS).set(admin.auth).expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({ action: 'user.promote', admin: null });
  });

  test('read the role on every request, so a demoted admin is refused at once', async () => {
    const admin = await signUpAdmin();
    await api().get(ACTIONS).set(admin.auth).expect(200);
    await prisma.user.update({ where: { email: admin.email }, data: { role: 'user' } });
    await api().get(ACTIONS).set(admin.auth).expect(403);
    await api().get('/api/v1/auth/me').set(admin.auth).expect(200);
  });
});

describe('last admin', () => {
  test('the only admin cannot delete their own account', async () => {
    const admin = await signUpAdmin();
    const res = await api().delete('/api/v1/auth/me').set(admin.auth).send({ current_password: admin.password }).expect(409);
    expect(res.body.error.code).toBe('LAST_ADMIN');
    await api().get('/api/v1/auth/me').set(admin.auth).expect(200);
  });

  test('an admin can delete their account while another admin remains', async () => {
    const admin = await signUpAdmin('First');
    await signUpAdmin('Second');
    await api().delete('/api/v1/auth/me').set(admin.auth).send({ current_password: admin.password }).expect(204);
    expect(await prisma.user.count({ where: { role: 'admin' } })).toBe(1);
  });

  test('two admins deleting themselves at the same moment leave one admin', async () => {
    const first = await signUpAdmin('First');
    const second = await signUpAdmin('Second');
    const results = await Promise.all([first, second].map((admin) => (
      api().delete('/api/v1/auth/me').set(admin.auth).send({ current_password: admin.password })
    )));
    expect(results.map((res) => res.status).sort()).toEqual([204, 409]);
    expect(await prisma.user.count({ where: { role: 'admin' } })).toBe(1);
  });

  test('a normal user can still delete their account', async () => {
    const user = await signUp();
    await api().delete('/api/v1/auth/me').set(user.auth).send({ current_password: user.password }).expect(204);
  });
});

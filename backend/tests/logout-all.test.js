const jwt = require('jsonwebtoken');
const { api, prisma, resetDatabase, signUp } = require('./helpers');
const realtimeGateway = require('../src/services/RealtimeGateway');

beforeEach(resetDatabase);
afterEach(() => jest.restoreAllMocks());
afterAll(() => prisma.$disconnect());

const URL = '/api/v1/auth/logout-all';

async function signInAgain(user) {
  const res = await api().post('/api/v1/auth/login').send({ email: user.email, password: user.password }).expect(200);
  return { Authorization: `Bearer ${res.body.token}` };
}

describe('sign out of all devices', () => {
  test('ends every session of the user and gives this device a new token', async () => {
    const user = await signUp();
    const otherDevice = await signInAgain(user);
    const copiedToken = { ...user.auth };

    const res = await api().post(URL).set(user.auth).send({ current_password: user.password }).expect(200);

    expect(typeof res.body.token).toBe('string');
    for (const auth of [user.auth, otherDevice, copiedToken]) {
      const ended = await api().get('/api/v1/auth/me').set(auth).expect(401);
      expect(ended.body.error.code).toBe('SESSION_ENDED');
    }
    await api().get('/api/v1/auth/me').set({ Authorization: `Bearer ${res.body.token}` }).expect(200);
  });

  test('does not touch the sessions of other users', async () => {
    const user = await signUp();
    const someoneElse = await signUp();
    await api().post(URL).set(user.auth).send({ current_password: user.password }).expect(200);
    await api().get('/api/v1/auth/me').set(someoneElse.auth).expect(200);
  });

  test('closes the live connections of the user', async () => {
    const user = await signUp();
    const disconnectUser = jest.spyOn(realtimeGateway, 'disconnectUser');
    await api().post(URL).set(user.auth).send({ current_password: user.password }).expect(200);
    expect(disconnectUser).toHaveBeenCalledWith(jwt.decode(user.token).sub);
  });

  test('refuses a wrong password and keeps every session', async () => {
    const user = await signUp();
    const otherDevice = await signInAgain(user);
    const res = await api().post(URL).set(user.auth).send({ current_password: 'wrong-password' }).expect(403);
    expect(res.body.error.code).toBe('WRONG_PASSWORD');
    await api().get('/api/v1/auth/me').set(user.auth).expect(200);
    await api().get('/api/v1/auth/me').set(otherDevice).expect(200);
  });

  test('asks for the current password', async () => {
    const user = await signUp();
    const res = await api().post(URL).set(user.auth).send({}).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('needs a signed-in user', async () => {
    const res = await api().post(URL).send({ current_password: 'password123' }).expect(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });
});

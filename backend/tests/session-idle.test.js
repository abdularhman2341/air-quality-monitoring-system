const jwt = require('jsonwebtoken');
const { api, prisma, resetDatabase, signUp } = require('./helpers');
const realtimeGateway = require('../src/services/RealtimeGateway');

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

function sessionId(user) {
  return jwt.decode(user.token).sid;
}

async function setLastUsed(user, minutesAgo) {
  await prisma.$executeRaw`
    UPDATE sessions SET last_used_at = now() - (${minutesAgo} * interval '1 minute')
    WHERE id = ${sessionId(user)}::uuid`;
}

async function lastUsed(user) {
  const [row] = await prisma.$queryRaw`SELECT last_used_at FROM sessions WHERE id = ${sessionId(user)}::uuid`;
  return row.last_used_at.getTime();
}

function connectSocket(token) {
  return new Promise((resolve) => {
    const socket = { handshake: { auth: { token } }, data: {} };
    realtimeGateway.authenticateSocket(socket, (err) => resolve(err ? err.message : 'OK'));
  });
}

describe('session idle timeout', () => {
  test('ends a session that has not been used for more than 15 minutes', async () => {
    const user = await signUp();
    await setLastUsed(user, 16);
    const res = await api().get('/api/v1/auth/me').set(user.auth).expect(401);
    expect(res.body.error.code).toBe('SESSION_ENDED');
  });

  test('keeps a session used 14 minutes ago and records the new use', async () => {
    const user = await signUp();
    await setLastUsed(user, 14);
    const before = await lastUsed(user);
    await api().get('/api/v1/auth/me').set(user.auth).expect(200);
    expect(await lastUsed(user)).toBeGreaterThan(before);
  });

  test('records the last use at most once a minute', async () => {
    const user = await signUp();
    await setLastUsed(user, 5);
    await api().get('/api/v1/auth/me').set(user.auth).expect(200);
    const first = await lastUsed(user);
    await api().get('/api/v1/auth/me').set(user.auth).expect(200);
    expect(await lastUsed(user)).toBe(first);
  });

  test('refuses a live connection for an idle session', async () => {
    const user = await signUp();
    expect(await connectSocket(user.token)).toBe('OK');
    await setLastUsed(user, 16);
    expect(await connectSocket(user.token)).toBe('SESSION_ENDED');
  });

  test('still ends a session at its expiry time even if it was just used', async () => {
    const user = await signUp();
    await prisma.$executeRaw`
      UPDATE sessions SET created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour'
      WHERE id = ${sessionId(user)}::uuid`;
    const res = await api().get('/api/v1/auth/me').set(user.auth).expect(401);
    expect(res.body.error.code).toBe('SESSION_ENDED');
  });
});

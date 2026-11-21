const { api, prisma, resetDatabase, signUp } = require('./helpers');
const mailService = require('../src/services/MailService');

beforeEach(async () => {
  await resetDatabase();
  mailService.clearOutbox();
});
afterAll(() => prisma.$disconnect());

const AUTH = '/api/v1/auth';
const pause = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

// Railway's edge writes the visitor's address in X-Real-IP, and X-Forwarded-For
// arrives with a CDN address on the right that changes between requests. The
// tests send both the same way (CLIENT_IP_HEADER=x-real-ip in tests/setup.js).
let cdn = 0;
const from = (ip) => {
  cdn += 1;
  return { 'X-Real-IP': ip, 'X-Forwarded-For': `${ip}, 192.0.2.${cdn % 250}` };
};
const login = (email, password, ip = '203.0.113.1') => api().post(`${AUTH}/login`).set(from(ip)).send({ email, password });
const forgot = (email, ip = '203.0.113.1') => api().post(`${AUTH}/forgot-password`).set(from(ip)).send({ email });
const reset = (email, code, ip = '203.0.113.1') => api().post(`${AUTH}/reset-password`).set(from(ip))
  .send({ email, code, new_password: 'new-password-456' });

async function makeHitsOlder(minutes) {
  await prisma.$executeRawUnsafe(`UPDATE rate_limit_hits SET created_at = created_at - interval '${minutes} minutes'`);
}

describe('failed sign-ins for one email', () => {
  test('the sixth try is refused, even with the right password, from any address', async () => {
    const user = await signUp();
    for (let i = 0; i < 5; i += 1) {
      await login(user.email, 'wrong-password').expect(401);
    }
    const res = await login(user.email, user.password).expect(429);
    expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    await login(user.email, user.password, '203.0.113.99').expect(429);
  });

  test('four wrong tries then the right password signs in and clears the count', async () => {
    const user = await signUp();
    for (let i = 0; i < 4; i += 1) {
      await login(user.email, 'wrong-password').expect(401);
    }
    await login(user.email, user.password).expect(200);
    for (let i = 0; i < 4; i += 1) {
      await login(user.email, 'wrong-password').expect(401);
    }
    await login(user.email, user.password).expect(200);
  });

  test('the lock ends after 15 minutes', async () => {
    const user = await signUp();
    for (let i = 0; i < 5; i += 1) {
      await login(user.email, 'wrong-password').expect(401);
    }
    await login(user.email, user.password).expect(429);
    await makeHitsOlder(16);
    await login(user.email, user.password).expect(200);
  });

  test('other accounts are not affected, and the email is counted in any letter case', async () => {
    const sara = await signUp('Sara');
    const omar = await signUp('Omar');
    for (let i = 0; i < 5; i += 1) {
      await login(sara.email.toUpperCase(), 'wrong-password').expect(401);
    }
    await login(sara.email, sara.password).expect(429);
    await login(omar.email, omar.password).expect(200);
  });

  test('an email with no account is limited the same way, so the answer does not show who is registered', async () => {
    for (let i = 0; i < 5; i += 1) {
      await login('nobody@test.local', 'wrong-password').expect(401);
    }
    await login('nobody@test.local', 'wrong-password').expect(429);
  });

  test('wrong tries sent at the same moment cannot go far past the limit', async () => {
    const user = await signUp();
    const results = await Promise.all(Array.from({ length: 12 }, () => login(user.email, 'wrong-password')));
    expect(results.filter((res) => res.status === 401).length).toBeLessThanOrEqual(5);
    await login(user.email, user.password).expect(429);
  });

  test('a locked account can still reset its password, which unlocks it', async () => {
    const user = await signUp();
    for (let i = 0; i < 5; i += 1) {
      await login(user.email, 'wrong-password').expect(401);
    }
    await forgot(user.email).expect(202);
    for (let i = 0; i < 100 && mailService.outbox.length < 1; i += 1) await pause(10);
    const code = /\b(\d{6})\b/.exec(mailService.outbox[0].text)[1];
    await reset(user.email, code).expect(204);
    await login(user.email, 'new-password-456').expect(200);
  });
});

describe('failed sign-ins from one address', () => {
  test('after 20 wrong tries across many emails that address is refused, others are not', async () => {
    const user = await signUp();
    for (let i = 0; i < 20; i += 1) {
      await login(`guess${i}@test.local`, 'wrong-password', '198.51.100.7').expect(401);
    }
    const res = await login(user.email, user.password, '198.51.100.7').expect(429);
    expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    await login(user.email, user.password, '198.51.100.8').expect(200);
  });
});

describe('the address of the visitor', () => {
  test('comes from X-Real-IP, so a changing X-Forwarded-For does not reset the count', async () => {
    for (let i = 0; i < 20; i += 1) {
      await api().post(`${AUTH}/login`)
        .set({ 'X-Real-IP': '198.51.100.70', 'X-Forwarded-For': `10.9.8.${i}, 192.0.2.${i}` })
        .send({ email: `guess${i}@test.local`, password: 'wrong-password' })
        .expect(401);
    }
    await login('guess20@test.local', 'wrong-password', '198.51.100.70').expect(429);
  });

  test('is not counted when the header is missing or is not an address', async () => {
    for (let i = 0; i < 21; i += 1) {
      await api().post(`${AUTH}/login`).send({ email: `nohdr${i}@test.local`, password: 'wrong-password' }).expect(401);
    }
    for (let i = 0; i < 21; i += 1) {
      await api().post(`${AUTH}/login`).set('X-Real-IP', 'not-an-address')
        .send({ email: `bad${i}@test.local`, password: 'wrong-password' }).expect(401);
    }
    expect(await prisma.rateLimitHit.count({ where: { scope: { not: 'login_email' } } })).toBe(0);
  });
});

describe('sign-ins that work', () => {
  test('are not counted for the address', async () => {
    const user = await signUp();
    for (let i = 0; i < 25; i += 1) {
      await login(user.email, user.password, '198.51.100.60').expect(200);
    }
    expect(await prisma.rateLimitHit.count()).toBe(0);
  });
});

describe('password reset requests', () => {
  test('one address can ask 10 times in 15 minutes', async () => {
    for (let i = 0; i < 10; i += 1) {
      await forgot(`person${i}@test.local`, '198.51.100.20').expect(202);
    }
    const res = await forgot('person10@test.local', '198.51.100.20').expect(429);
    expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    await forgot('person10@test.local', '198.51.100.21').expect(202);
  });

  test('one email gets at most 3 codes in 15 minutes, and the answer stays the same', async () => {
    const user = await signUp();
    for (let i = 0; i < 3; i += 1) {
      await forgot(user.email, `198.51.100.${30 + i}`).expect(202);
      await prisma.$executeRawUnsafe("UPDATE verification_codes SET created_at = created_at - interval '61 seconds'");
    }
    await pause();
    expect(mailService.outbox).toHaveLength(3);
    const res = await forgot(user.email, '198.51.100.40').expect(202);
    await pause();
    expect(mailService.outbox).toHaveLength(3);
    expect(res.body).toEqual({ message: 'If this email has an account, a code was sent to it.' });
  });

  test('wrong codes from one address are refused after 20 tries', async () => {
    for (let i = 0; i < 20; i += 1) {
      await reset(`guess${i}@test.local`, '123456', '198.51.100.50').expect(400);
    }
    const res = await reset('guess20@test.local', '123456', '198.51.100.50').expect(429);
    expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    await reset('guess20@test.local', '123456', '198.51.100.51').expect(400);
  });
});

describe('old rows', () => {
  test('are deleted when a new one is saved', async () => {
    await login('nobody@test.local', 'wrong-password').expect(401);
    await makeHitsOlder(60 * 25);
    await login('other@test.local', 'wrong-password').expect(401);
    const rows = await prisma.rateLimitHit.findMany();
    expect(rows.every((row) => Date.now() - row.created_at < 60 * 60 * 1000)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });
});

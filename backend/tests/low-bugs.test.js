const path = require('path');
const { spawnSync } = require('child_process');
const { api, prisma, resetDatabase, signUp, registerDevice, linkDevice, publish } = require('./helpers');
const realtimeGateway = require('../src/services/RealtimeGateway');
const emails = require('../src/utils/emails');

const MAC = 'AAAAAAAAAA06';
const now = () => new Date().toISOString();

beforeEach(resetDatabase);
afterEach(() => jest.restoreAllMocks());
afterAll(() => prisma.$disconnect());

// B7: Prisma sends PostgreSQL years 0000 to 9999. A date outside
// them was a valid JavaScript date, reached the database and came back 500.
describe('dates outside years 0000-9999 (B7)', () => {
  test.each([
    ['+010000-01-01T00:00:00Z'],
    ['-000001-01-01T00:00:00Z'],
    ['+275760-09-13T00:00:00Z'],
  ])('%s is refused with 400', async (date) => {
    const user = await signUp();
    const alerts = await api().get('/api/v1/alerts').query({ from: date }).set(user.auth);
    expect([alerts.status, alerts.body.error.code]).toEqual([400, 'VALIDATION_ERROR']);
    expect(alerts.body.error.message).toBe('from must be a valid ISO 8601 date.');
    const readings = await api().get(`/api/v1/devices/${MAC}/readings`).query({ to: date }).set(user.auth);
    expect([readings.status, readings.body.error.message]).toEqual([400, 'to must be a valid ISO 8601 date.']);
  });

  test.each([['0000-01-01T00:00:00Z'], ['9999-12-31T23:59:59Z']])('%s, at the edge, is accepted', async (date) => {
    const user = await signUp();
    await api().get('/api/v1/alerts').query({ from: date }).set(user.auth).expect(200);
  });
});

// B10: a device whose "online" status message was lost stayed offline on the
// dashboard while its readings came in.
describe('a reading marks its device online (B10)', () => {
  let user;
  beforeEach(async () => {
    user = await signUp();
    await linkDevice(user, MAC, await registerDevice(MAC));
  });

  test('an offline device becomes online and the owner is told once', async () => {
    const emit = jest.spyOn(realtimeGateway, 'emitToOwner');
    await publish(MAC, 'readings', { lpg_ppm_est: 100, alarm_active: false, ts: now() });
    await publish(MAC, 'readings', { lpg_ppm_est: 101, alarm_active: false, ts: new Date(Date.now() + 1000).toISOString() });
    const device = await prisma.device.findUnique({ where: { device_id: MAC } });
    expect(device.connection_state).toBe('online');
    expect(device.online_since).not.toBeNull();
    const statusEvents = emit.mock.calls.filter(([, event]) => event === 'device:status');
    expect(statusEvents).toHaveLength(1);
    expect(statusEvents[0][0]).toBe((await prisma.user.findFirst()).id);
    expect(statusEvents[0][2]).toMatchObject({ device_id: MAC, state: 'online' });
  });

  test('an online device keeps its online_since', async () => {
    await publish(MAC, 'status', { state: 'online' });
    const before = (await prisma.device.findUnique({ where: { device_id: MAC } })).online_since;
    const emit = jest.spyOn(realtimeGateway, 'emitToOwner');
    await publish(MAC, 'readings', { lpg_ppm_est: 100, alarm_active: false, ts: now() });
    const after = await prisma.device.findUnique({ where: { device_id: MAC } });
    expect(after.online_since).toEqual(before);
    expect(emit.mock.calls.filter(([, event]) => event === 'device:status')).toHaveLength(0);
  });

  test('a duplicate reading does not mark it online again', async () => {
    const reading = { lpg_ppm_est: 100, alarm_active: false, ts: now() };
    await publish(MAC, 'readings', reading);
    await publish(MAC, 'status', { state: 'offline' });
    await publish(MAC, 'readings', reading);
    expect((await prisma.device.findUnique({ where: { device_id: MAC } })).connection_state).toBe('offline');
  });
});

// B11: the demo seed adds devices with known pairing codes; on production
// anyone could link them.
describe('seedDevices on production (B11)', () => {
  const runSeed = (env) => spawnSync('node', [path.join(__dirname, '../src/scripts/seedDevices.js')], {
    env: { ...process.env, ...env }, encoding: 'utf8',
  });

  test.each([
    ['NODE_ENV=production', { NODE_ENV: 'production' }],
    ['a Railway environment', { RAILWAY_ENVIRONMENT_NAME: 'production' }],
  ])('refuses to run with %s', (_name, env) => {
    const result = runSeed(env);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing to add demo devices on production.');
  });

  test('refuses before touching the database', async () => {
    runSeed({ NODE_ENV: 'production' });
    expect(await prisma.device.count()).toBe(0);
  });

  test('still runs on a development database', async () => {
    const result = runSeed({ NODE_ENV: 'development', RAILWAY_ENVIRONMENT_NAME: '' });
    expect(result.status).toBe(0);
    expect(await prisma.device.count()).toBe(2);
  });
});

// C1: pairing codes are capitals printed as ABCD-EFGH. Decision (23 Nov):
// lowercase, a missing dash and spaces still match.
describe('pairing code case and dash (C1)', () => {
  const link = (user, code) => api().post('/api/v1/devices').set(user.auth)
    .send({ mac_address: MAC, pairing_code: code, name: 'Kitchen' });

  test.each([['abcd-efgh'], ['ABCDEFGH'], ['abcd efgh'], ['Abcd-Efgh']])('%s matches ABCD-EFGH', async (typed) => {
    const user = await signUp();
    await registerDevice(MAC, 'ABCD-EFGH');
    await link(user, typed).expect(201);
  });

  test('a different code still does not match', async () => {
    const user = await signUp();
    await registerDevice(MAC, 'ABCD-EFGH');
    const res = await link(user, 'abcd-efgk').expect(404);
    expect(res.body.error.code).toBe('DEVICE_NOT_FOUND');
  });

  test('an old 6-digit code still matches as typed', async () => {
    const user = await signUp();
    await registerDevice(MAC, '482913');
    await link(user, '482913').expect(201);
  });

  test('a dash typed in the wrong place still matches', async () => {
    const user = await signUp();
    await registerDevice(MAC, 'ABCD-EFGH');
    await link(user, 'ABC-DEFGH').expect(201);
  });
});

// C2: decision (23 Nov): every email says Gas Monitor, the name of the site.
describe('one product name in emails (C2)', () => {
  const all = () => [
    emails.passwordResetEmail('123456', 15),
    emails.passwordChangedEmail(),
    emails.emailVerificationEmail('123456', 15),
    emails.emailChangeEmail('123456', 15),
    emails.emailChangedEmail('n@x.y'),
  ];

  test('no email says AQMS', () => {
    for (const mail of all()) {
      expect(JSON.stringify(mail)).not.toContain('AQMS');
    }
  });

  test('the password emails say Gas Monitor', () => {
    const [reset, changed] = all();
    expect(reset.subject).toBe('123456 رمز استعادة كلمة المرور | Gas Monitor password reset code');
    expect(changed.subject).toBe('تم تغيير كلمة المرور | Your Gas Monitor password was changed');
  });
});

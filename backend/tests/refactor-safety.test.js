// Records what code with no direct test does today, before it is split into
// shorter functions. These tests must pass unchanged before and after.
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const { Prisma } = require('@prisma/client');
const { api, prisma, resetDatabase, signUp } = require('./helpers');
const { makeAdmin } = require('../src/scripts/makeAdmin');
const errorHandler = require('../src/middlewares/errorHandler');
const HttpError = require('../src/errors/HttpError');
const { gasAlertEmail, gasAlertEndedEmail } = require('../src/utils/emails');

jest.mock('mqtt', () => ({ connect: jest.fn() }));

beforeEach(resetDatabase);
afterEach(() => jest.restoreAllMocks());
afterAll(() => prisma.$disconnect());

function fakeResponse() {
  const res = { headers: {} };
  res.set = (name, value) => { res.headers[name] = value; return res; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

function handle(err) {
  const res = fakeResponse();
  errorHandler(err, { method: 'GET', originalUrl: '/x' }, res, () => {});
  return res;
}

describe('errorHandler', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));

  test('a database that cannot be reached is 503 with Retry-After', () => {
    const err = new Prisma.PrismaClientKnownRequestError('down', { code: 'P1001', clientVersion: 'x' });
    const res = handle(err);
    expect(res.statusCode).toBe(503);
    expect(res.headers).toEqual({ 'Retry-After': '30' });
    expect(res.body).toEqual({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is unavailable. Try again shortly.' } });
  });

  test('other Prisma errors are not treated as an unreachable database', () => {
    const err = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
    expect(handle(err).statusCode).toBe(500);
  });

  test('an HttpError keeps its status, code and message', () => {
    const res = handle(new HttpError(409, 'EMAIL_TAKEN', 'Taken.'));
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: { code: 'EMAIL_TAKEN', message: 'Taken.' } });
    expect(console.error).not.toHaveBeenCalled();
  });

  test('an error with only a status becomes BAD_REQUEST with its message', () => {
    const res = handle(Object.assign(new Error('Bad JSON'), { status: 400 }));
    expect(res.body).toEqual({ error: { code: 'BAD_REQUEST', message: 'Bad JSON' } });
  });

  test('anything else is a logged 500 that hides the details', () => {
    const res = handle(new Error('secret detail'));
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error.' } });
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  test('an HttpError with status 500 keeps its own code but hides its message', () => {
    const res = handle(new HttpError(500, 'MAIL_FAILED', 'inner'));
    expect(res.body).toEqual({ error: { code: 'MAIL_FAILED', message: 'Unexpected server error.' } });
  });
});

describe('gas alert email text', () => {
  const startedAt = new Date('2026-11-21T18:05:00Z');

  test('the alarm email, with a location and a link', () => {
    const device = { name: 'Kitchen\n  sensor', location: 'Floor 1' };
    expect(gasAlertEmail({ device, ppm: 1250.4, thresholdPpm: 1000, startedAt, appUrl: 'https://gas.example' }))
      .toMatchSnapshot();
  });

  test('the alarm email without a name, location or link', () => {
    expect(gasAlertEmail({ device: {}, ppm: 999.6, thresholdPpm: 800.2, startedAt })).toMatchSnapshot();
  });

  test('the alarm-ended email', () => {
    const device = { name: 'Kitchen', location: null };
    expect(gasAlertEndedEmail({ device, peakPpm: 1400.5, endedAt: startedAt, appUrl: 'https://gas.example' }))
      .toMatchSnapshot();
  });
});

describe('admin email change', () => {
  test('drops the verification and the pending email, and sends a new activation code', async () => {
    const admin = await signUp('Admin');
    await makeAdmin(admin.email);
    const user = await signUp('Sara');
    const row = await prisma.user.findUnique({ where: { email: user.email } });
    await prisma.user.update({ where: { id: row.id }, data: { pending_email: 'next@test.local' } });
    await prisma.verificationCode.create({
      data: { user_id: row.id, purpose: 'change_email', code_hash: 'x', expires_at: new Date(Date.now() + 60000) },
    });
    await prisma.verificationCode.create({
      data: { user_id: row.id, purpose: 'reset_password', code_hash: 'y', expires_at: new Date(Date.now() + 60000) },
    });

    await api().patch(`/api/v1/admin/users/${row.id}`).set(admin.auth).send({ email: 'moved@test.local' }).expect(200);

    const after = await prisma.user.findUnique({ where: { id: row.id } });
    expect(after).toMatchObject({ email: 'moved@test.local', email_verified_at: null, pending_email: null });
    const codes = await prisma.verificationCode.findMany({ where: { user_id: row.id } });
    expect(codes.map((code) => code.purpose).sort()).toEqual(['reset_password', 'verify_email']);
  });

  test('a name that does not change saves and logs nothing', async () => {
    const admin = await signUp('Admin');
    await makeAdmin(admin.email);
    const user = await signUp('Sara');
    const row = await prisma.user.findUnique({ where: { email: user.email } });
    await api().patch(`/api/v1/admin/users/${row.id}`).set(admin.auth).send({ name: 'Sara' }).expect(200);
    expect(await prisma.adminAction.count({ where: { action: 'user.update' } })).toBe(0);
  });
});

describe('MQTT connection settings', () => {
  const mqtt = require('mqtt');
  const mqttSubscriber = require('../src/services/MqttSubscriberService');
  const saved = { ...process.env };

  afterEach(() => {
    mqtt.connect.mockReset();
    process.env = { ...saved };
    mqttSubscriber.client = undefined;
  });

  test('stays off without MQTT_URL', () => {
    delete process.env.MQTT_URL;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mqttSubscriber.connect();
    expect(mqtt.connect).not.toHaveBeenCalled();
    expect(mqttSubscriber.status).toBe('disabled');
  });

  test('keeps its broker session and subscribes once connected', () => {
    process.env.MQTT_URL = 'mqtt://broker.test:1883';
    process.env.MQTT_USERNAME = 'backend';
    process.env.MQTT_PASSWORD = 'pw';
    delete process.env.MQTT_CLIENT_ID;
    const handlers = {};
    const fake = { on: (event, fn) => { handlers[event] = fn; }, subscribe: jest.fn(), connected: false };
    mqtt.connect.mockReturnValue(fake);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mqttSubscriber.connect();
    expect(mqtt.connect).toHaveBeenCalledWith('mqtt://broker.test:1883', {
      clientId: 'aqms-backend', username: 'backend', password: 'pw', clean: false, reconnectPeriod: 5000,
    });
    expect(Object.keys(handlers).sort()).toEqual(['connect', 'error']);
    expect(typeof fake.handleMessage).toBe('function');
    handlers.connect();
    expect(fake.subscribe).toHaveBeenCalledWith('aqms/devices/+/#', { qos: 1 }, expect.any(Function));
  });
});

describe('npm run seed:devices', () => {
  const run = () => promisify(execFile)(process.execPath, [path.join(__dirname, '../src/scripts/seedDevices.js')], {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });

  test('adds two demo devices with 30 readings each, then skips them', async () => {
    const first = await run();
    expect(first.stdout).toBe([
      'A4CF123B9E01 created with 30 readings (pairing code 482913)',
      'A4CF123B9E7F created with 30 readings (pairing code 735104)',
      '',
    ].join('\n'));
    const devices = await prisma.device.findMany({ orderBy: { device_id: 'asc' } });
    expect(devices.map((d) => [d.device_id, d.connection_state, d.online_since !== null])).toEqual([
      ['A4CF123B9E01', 'online', true],
      ['A4CF123B9E7F', 'offline', false],
    ]);
    expect(await prisma.reading.count()).toBe(60);
    expect(await prisma.reading.count({ where: { alarm_active: true } })).toBe(1);
    const last = await prisma.reading.findFirst({ where: { device_id: 'A4CF123B9E7F' }, orderBy: { seq: 'desc' } });
    expect(devices[1].last_reading_at).toEqual(last.reading_time);

    const second = await run();
    expect(second.stdout).toBe('A4CF123B9E01 already exists, skipped\nA4CF123B9E7F already exists, skipped\n');
    expect(await prisma.reading.count()).toBe(60);
  }, 30000);
});

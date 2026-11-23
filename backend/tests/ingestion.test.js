const { api, prisma, resetDatabase, signUp, registerDevice, linkDevice, publish } = require('./helpers');

const MAC = 'AAAAAAAAAA03';

beforeEach(async () => {
  await resetDatabase();
  const user = await signUp();
  const code = await registerDevice(MAC);
  await linkDevice(user, MAC, code);
});
afterAll(() => prisma.$disconnect());

const now = () => new Date().toISOString();

describe('readings', () => {
  test('the same reading delivered twice (QoS 1) is stored once', async () => {
    const reading = { seq: 1, lpg_ppm_est: 250, alarm_active: false, ts: now() };
    await publish(MAC, 'readings', reading);
    await publish(MAC, 'readings', reading);
    expect(await prisma.reading.count()).toBe(1);
  });

  test('a payload whose device_id does not match the topic is dropped', async () => {
    const payload = Buffer.from(JSON.stringify({ device_id: 'BBBBBBBBBB99', lpg_ppm_est: 1, alarm_active: false, ts: now() }));
    const mqtt = require('../src/services/MqttSubscriberService');
    await mqtt.handleMessage(`aqms/devices/${MAC}/readings`, payload);
    expect(await prisma.reading.count()).toBe(0);
  });

  test('a reading from an unregistered device is dropped', async () => {
    await publish('CCCCCCCCCC04', 'readings', { lpg_ppm_est: 1, alarm_active: false, ts: now() });
    expect(await prisma.reading.count()).toBe(0);
  });

  test('a reading that waited 30 minutes at the broker keeps its real time', async () => {
    const ts = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await publish(MAC, 'readings', { seq: 1, lpg_ppm_est: 1, alarm_active: false, ts });
    const reading = await prisma.reading.findFirst();
    expect(reading.reading_time.toISOString()).toBe(ts);
  });

  test('a late message delivered twice is saved once', async () => {
    const message = { seq: 7, lpg_ppm_est: 1, alarm_active: false, ts: new Date(Date.now() - 30 * 60 * 1000).toISOString() };
    await publish(MAC, 'readings', message);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await publish(MAC, 'readings', message);
    expect(await prisma.reading.count()).toBe(1);
  });

  // B5: an optional sensor field the database would refuse is stored as
  // null, and the reading itself (gas level and alarm) is kept.
  test.each([
    ['sensor_raw_adc above 4095', { sensor_raw_adc: 4096 }, { sensor_raw_adc: null }],
    ['sensor_raw_adc below 0', { sensor_raw_adc: -1 }, { sensor_raw_adc: null }],
    ['seq too big for the column', { seq: 2 ** 31 }, { seq: null }],
    ['seq below the column range', { seq: -(2 ** 31) - 1 }, { seq: null }],
  ])('a reading with %s is kept, that field as null (B5)', async (_name, fields, stored) => {
    await publish(MAC, 'readings', { lpg_ppm_est: 250, alarm_active: false, ts: now(), ...fields });
    const reading = await prisma.reading.findFirst();
    expect(reading).toMatchObject({ lpg_ppm_est: 250, ...stored });
  });

  test('the edges of the optional ranges are kept as sent (B5)', async () => {
    await publish(MAC, 'readings', { seq: 2 ** 31 - 1, sensor_raw_adc: 4095, lpg_ppm_est: 1, alarm_active: false, ts: now() });
    await publish(MAC, 'readings', {
      seq: -(2 ** 31), sensor_raw_adc: 0, lpg_ppm_est: 2, alarm_active: false, ts: new Date(Date.now() + 1000).toISOString(),
    });
    const rows = await prisma.reading.findMany({ orderBy: { lpg_ppm_est: 'asc' } });
    expect(rows.map((r) => [r.seq, r.sensor_raw_adc])).toEqual([[2 ** 31 - 1, 4095], [-(2 ** 31), 0]]);
  });

  test('a gas level of zero is still saved (B5)', async () => {
    await publish(MAC, 'readings', { lpg_ppm_est: 0, alarm_active: false, ts: now() });
    expect(await prisma.reading.count()).toBe(1);
  });

  test('a negative gas level can never be saved, so it is dropped and acknowledged (B5)', async () => {
    await expect(publish(MAC, 'readings', { lpg_ppm_est: -1, alarm_active: false, ts: now() })).resolves.toBeUndefined();
    expect(await prisma.reading.count()).toBe(0);
  });

  test('a device clock far from server time falls back to the server time', async () => {
    await publish(MAC, 'readings', { lpg_ppm_est: 1, alarm_active: false, ts: '1970-01-01T00:00:00Z' });
    const reading = await prisma.reading.findFirst();
    expect(Math.abs(reading.reading_time - Date.now())).toBeLessThan(60 * 1000);
  });
});

describe('alerts', () => {
  const alarm = (event, ppm) => ({ event, lpg_ppm_est: ppm, threshold_ppm: 1000, ts: now() });

  test('an alarm that waited 30 minutes keeps its real start time', async () => {
    const ts = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await publish(MAC, 'alarms', { ...alarm('alarm_on', 1200), ts });
    const alert = await prisma.alert.findFirst();
    expect(alert.started_at.toISOString()).toBe(ts);
  });

  test('an alert left open by a power cut closes at the first reading without the alarm (issue #42)', async () => {
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    const ts = new Date(Date.now() + 1000).toISOString();
    await publish(MAC, 'readings', { seq: 2, lpg_ppm_est: 90, alarm_active: false, ts });
    const alert = await prisma.alert.findFirst();
    expect(alert.ended_at && alert.ended_at.toISOString()).toBe(ts);
    await publish(MAC, 'alarms', alarm('alarm_on', 1300));
    expect(await prisma.alert.count()).toBe(2);
  });

  test('a reading from before the alert started does not close it', async () => {
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    const before = new Date(Date.now() - 60 * 1000).toISOString();
    await publish(MAC, 'readings', { seq: 3, lpg_ppm_est: 90, alarm_active: false, ts: before });
    expect((await prisma.alert.findFirst()).ended_at).toBeNull();
  });

  test('a repeated alarm_on does not open a second alert', async () => {
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    await publish(MAC, 'alarms', alarm('alarm_on', 1300));
    expect(await prisma.alert.count()).toBe(1);
  });

  test('readings during an alert raise its peak, and alarm_off closes it', async () => {
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    await publish(MAC, 'readings', { lpg_ppm_est: 1750, alarm_active: true, ts: now() });
    await publish(MAC, 'alarms', alarm('alarm_off', 700));

    const alert = await prisma.alert.findFirst();
    expect(alert.peak_lpg_ppm_est).toBe(1750);
    expect(alert.ended_at).not.toBeNull();
  });

  test('alarm_off without an open alert is ignored (see issue #41)', async () => {
    await publish(MAC, 'alarms', alarm('alarm_off', 700));
    expect(await prisma.alert.count()).toBe(0);
  });

  // B4: QoS 1 can deliver alarm_on again after alarm_off was handled.
  test('an alarm_on delivered again after alarm_off does not open a new alert (B4)', async () => {
    const on = alarm('alarm_on', 1200);
    await publish(MAC, 'alarms', on);
    await publish(MAC, 'alarms', { ...alarm('alarm_off', 700), ts: new Date(Date.now() + 1000).toISOString() });
    await publish(MAC, 'alarms', on);
    expect(await prisma.alert.count()).toBe(1);
    expect(await prisma.alert.count({ where: { ended_at: null } })).toBe(0);
  });

  test('the copy is recognised by its time, also when the alert was closed by a reading (B4)', async () => {
    const on = alarm('alarm_on', 1200);
    await publish(MAC, 'alarms', on);
    await publish(MAC, 'readings', { lpg_ppm_est: 90, alarm_active: false, ts: new Date(Date.now() + 1000).toISOString() });
    await publish(MAC, 'alarms', on);
    const next = new Date(Date.parse(on.ts) + 1).toISOString();
    await publish(MAC, 'alarms', { ...on, ts: next });
    const open = await prisma.alert.findMany({ where: { ended_at: null } });
    expect(open.map((a) => a.started_at.toISOString())).toEqual([next]);
  });

  test('a new alarm_on after the last alert ended still opens an alert (B4)', async () => {
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    const end = new Date(Date.now() + 1000);
    await publish(MAC, 'alarms', { ...alarm('alarm_off', 700), ts: end.toISOString() });
    await publish(MAC, 'alarms', { ...alarm('alarm_on', 1400), ts: new Date(end.getTime() + 1).toISOString() });
    expect(await prisma.alert.count()).toBe(2);
    const open = await prisma.alert.findFirst({ where: { ended_at: null } });
    expect(open.peak_lpg_ppm_est).toBe(1400);
  });

  test('a copy of the newest of two closed alerts is ignored (B4)', async () => {
    const t = Date.now();
    const at = (ms) => new Date(t + ms).toISOString();
    await publish(MAC, 'alarms', { ...alarm('alarm_on', 1200), ts: at(0) });
    await publish(MAC, 'alarms', { ...alarm('alarm_off', 700), ts: at(1000) });
    const second = { ...alarm('alarm_on', 1300), ts: at(2000) };
    await publish(MAC, 'alarms', second);
    await publish(MAC, 'alarms', { ...alarm('alarm_off', 700), ts: at(3000) });
    await publish(MAC, 'alarms', second);
    expect(await prisma.alert.count()).toBe(2);
  });

  test('an alarm_on older than the last alert is a new alarm, not a copy (B4)', async () => {
    const t = Date.now();
    await publish(MAC, 'alarms', { ...alarm('alarm_on', 1200), ts: new Date(t).toISOString() });
    await publish(MAC, 'alarms', { ...alarm('alarm_off', 700), ts: new Date(t + 1000).toISOString() });
    await publish(MAC, 'alarms', { ...alarm('alarm_on', 1300), ts: new Date(t - 10000).toISOString() });
    expect(await prisma.alert.count()).toBe(2);
  });

  test('the repeat check looks only at this device (B4)', async () => {
    const OTHER = 'AAAAAAAAAA05';
    const code = await registerDevice(OTHER, 'WXYZ-QRST');
    await linkDevice(await signUp(), OTHER, code);
    const on = alarm('alarm_on', 1200);
    await publish(OTHER, 'alarms', on);
    await publish(OTHER, 'alarms', { ...alarm('alarm_off', 700), ts: new Date(Date.now() + 1000).toISOString() });
    await publish(MAC, 'alarms', on);
    expect(await prisma.alert.count({ where: { device_id: MAC, ended_at: null } })).toBe(1);
  });
});

describe('connection state', () => {
  test('status online then the Last Will offline update the device', async () => {
    await publish(MAC, 'status', { state: 'online', ts: now() });
    let device = await prisma.device.findUnique({ where: { device_id: MAC } });
    expect(device.connection_state).toBe('online');

    await publish(MAC, 'status', { state: 'offline' });
    device = await prisma.device.findUnique({ where: { device_id: MAC } });
    expect(device.connection_state).toBe('offline');
  });
});

describe('a device with no owner', () => {
  const FREE = 'AAAAAAAAAA09';
  const reading = () => ({ seq: 1, lpg_ppm_est: 1200, alarm_active: true, ts: now() });
  const alarmOn = () => ({ event: 'alarm_on', lpg_ppm_est: 1200, threshold_ppm: 1000, ts: now() });

  beforeEach(() => registerDevice(FREE));

  test('its readings and alarms are acknowledged but not kept', async () => {
    await publish(FREE, 'readings', reading());
    await publish(FREE, 'alarms', alarmOn());
    expect(await prisma.reading.count({ where: { device_id: FREE } })).toBe(0);
    expect(await prisma.alert.count({ where: { device_id: FREE } })).toBe(0);
  });

  test('its status is still kept, so the next owner sees it online', async () => {
    await publish(FREE, 'status', { state: 'online', ts: now() });
    const device = await prisma.device.findUnique({ where: { device_id: FREE } });
    expect(device.connection_state).toBe('online');
  });

  test('the next owner starts with an empty history after the device was unlinked', async () => {
    const first = await signUp();
    await linkDevice(first, FREE, 'ABCD-EFGH');
    await api().delete(`/api/v1/devices/${FREE}`).set(first.auth).expect(204);
    await publish(FREE, 'readings', reading());
    await publish(FREE, 'alarms', alarmOn());
    const next = await signUp();
    await linkDevice(next, FREE, 'ABCD-EFGH');
    const readings = await api().get(`/api/v1/devices/${FREE}/readings`).set(next.auth).expect(200);
    const alerts = await api().get('/api/v1/alerts').set(next.auth).expect(200);
    expect(readings.body.total).toBe(0);
    expect(alerts.body.total).toBe(0);
  });
});

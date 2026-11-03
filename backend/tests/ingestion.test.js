const { prisma, resetDatabase, signUp, registerDevice, linkDevice, publish } = require('./helpers');

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

  test('a device clock far from server time falls back to the server time', async () => {
    await publish(MAC, 'readings', { lpg_ppm_est: 1, alarm_active: false, ts: '1970-01-01T00:00:00Z' });
    const reading = await prisma.reading.findFirst();
    expect(Math.abs(reading.reading_time - Date.now())).toBeLessThan(60 * 1000);
  });
});

describe('alerts', () => {
  const alarm = (event, ppm) => ({ event, lpg_ppm_est: ppm, threshold_ppm: 1000, ts: now() });

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

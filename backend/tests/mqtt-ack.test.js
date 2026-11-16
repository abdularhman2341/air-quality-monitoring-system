const EventEmitter = require('events');

jest.mock('mqtt', () => ({ connect: jest.fn() }));

const mqtt = require('mqtt');
const Device = require('../src/models/Device');
const readingService = require('../src/services/ReadingService');
const mqttSubscriber = require('../src/services/MqttSubscriberService');

let client;
let deviceCount = 0;
let TOPIC;
let READING;

function fakeClient() {
  const fake = new EventEmitter();
  fake.subscribe = jest.fn();
  fake.handleMessage = (packet, done) => done();
  fake.stream = { destroy: jest.fn() };
  return fake;
}

function deliver(topic, payload) {
  const result = { acked: false, error: null };
  result.finished = new Promise((resolve) => {
    client.emit('message', topic, payload, { topic, payload, qos: 1 });
    client.handleMessage({ topic, payload, qos: 1 }, (error) => {
      if (error) result.error = error;
      else result.acked = true;
      resolve();
    });
  });
  return result;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  process.env.MQTT_URL = 'mqtt://broker.test:1883';
  deviceCount += 1;
  const device = `AAAAAAAAAA${String(deviceCount).padStart(2, '0')}`;
  TOPIC = `aqms/devices/${device}/readings`;
  READING = Buffer.from(JSON.stringify({
    device_id: device, lpg_ppm_est: 120, alarm_active: false, ts: '2026-11-16T10:00:00Z',
  }));
  client = fakeClient();
  mqtt.connect.mockReturnValue(client);
  jest.spyOn(Device, 'findOwnerId').mockResolvedValue(7);
  mqttSubscriber.connect();
});

afterEach(() => {
  delete process.env.MQTT_URL;
  jest.restoreAllMocks();
});

describe('MQTT acknowledgement (PUBACK)', () => {
  test('acks a reading only after it is saved', async () => {
    let finishSave;
    jest.spyOn(readingService, 'processTelemetry')
      .mockReturnValue(new Promise((resolve) => { finishSave = resolve; }));

    const delivery = deliver(TOPIC, READING);
    await tick();
    expect(delivery.acked).toBe(false);

    finishSave();
    await delivery.finished;
    expect(delivery.acked).toBe(true);
  });

  test('does not ack when saving fails, and reconnects so the broker sends it again', async () => {
    jest.spyOn(readingService, 'processTelemetry').mockRejectedValue(new Error('database is down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const delivery = deliver(TOPIC, READING);
    await delivery.finished;

    expect(delivery.acked).toBe(false);
    expect(client.stream.destroy).toHaveBeenCalled();
  });

  test('acks a broken message so the broker does not send it again', async () => {
    const save = jest.spyOn(readingService, 'processTelemetry').mockResolvedValue();
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    const delivery = deliver(TOPIC, Buffer.from('not json'));
    await delivery.finished;

    expect(delivery.acked).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  test('handles each message once', async () => {
    const save = jest.spyOn(readingService, 'processTelemetry').mockResolvedValue();

    const delivery = deliver(TOPIC, READING);
    await delivery.finished;
    for (let i = 0; i < 10; i += 1) await tick();

    expect(save).toHaveBeenCalledTimes(1);
  });
});
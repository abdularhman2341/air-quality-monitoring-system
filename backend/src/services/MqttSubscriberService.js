const mqtt = require('mqtt');
const Device = require('../models/Device');
const readingService = require('./ReadingService');
const alertService = require('./AlertService');
const deviceService = require('./DeviceService');

const DEVICE_TOPICS = 'aqms/devices/+/#';
const TOPIC_PATTERN = /^aqms\/devices\/([0-9A-F]{12})\/(readings|alarms|status)$/;

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isTimestamp = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));

const VALIDATORS = {
  readings: (message) => {
    if (!isNumber(message.lpg_ppm_est)) return 'lpg_ppm_est must be a number';
    if (typeof message.alarm_active !== 'boolean') return 'alarm_active must be true or false';
    if (!isTimestamp(message.ts)) return 'ts must be an ISO date';
    return null;
  },
  alarms: (message) => {
    if (!['alarm_on', 'alarm_off'].includes(message.event)) return 'event must be alarm_on or alarm_off';
    if (!isNumber(message.lpg_ppm_est)) return 'lpg_ppm_est must be a number';
    if (!isNumber(message.threshold_ppm)) return 'threshold_ppm must be a number';
    if (!isTimestamp(message.ts)) return 'ts must be an ISO date';
    return null;
  },
  status: (message) => {
    if (!['online', 'offline'].includes(message.state)) return 'state must be online or offline';
    return null;
  },
};

const HANDLERS = {
  readings: (deviceId, message) => readingService.processTelemetry(deviceId, message),
  alarms: (deviceId, message) => alertService.handleAlarmEvent(deviceId, message),
  status: (deviceId, message) => deviceService.updateDeviceStatus(deviceId, message.state),
};

class MqttSubscriberService {
  constructor() {
    this.queues = new Map();
  }

  connect() {
    const url = process.env.MQTT_URL;
    if (!url) {
      console.log('MQTT_URL is not set, MQTT ingestion is off');
      return;
    }
    this.client = mqtt.connect(url, {
      clientId: process.env.MQTT_CLIENT_ID || 'aqms-backend',
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clean: false,
      reconnectPeriod: 5000,
    });
    this.client.on('connect', () => {
      console.log(`MQTT connected to ${url}`);
      this.subscribe(DEVICE_TOPICS);
    });
    this.client.on('error', (err) => console.error(`MQTT error: ${err.message}`));
    this.client.on('message', (topic, payload) => this.enqueue(topic, payload));
  }

  enqueue(topic, payload) {
    const key = topic.split('/')[2] || topic;
    const previous = this.queues.get(key) || Promise.resolve();
    const current = previous
      .then(() => this.handleMessage(topic, payload))
      .catch((err) => console.error(`MQTT ${topic}: ${err.message}`));
    this.queues.set(key, current);
    current.then(() => {
      if (this.queues.get(key) === current) this.queues.delete(key);
    });
  }

  subscribe(topic) {
    this.client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) console.error(`MQTT subscribe failed: ${err.message}`);
    });
  }

  async handleMessage(topic, payload) {
    const match = TOPIC_PATTERN.exec(topic);
    if (!match) return this.drop(topic, 'unknown topic');
    const [, deviceId, kind] = match;

    let message;
    try {
      message = JSON.parse(payload.toString());
    } catch (err) {
      return this.drop(topic, 'payload is not valid JSON');
    }
    if (message === null || typeof message !== 'object') return this.drop(topic, 'payload must be a JSON object');
    if (message.device_id !== deviceId) return this.drop(topic, 'device_id does not match the topic');

    const problem = VALIDATORS[kind](message);
    if (problem) return this.drop(topic, problem);
    if (!(await Device.isRegistered(deviceId))) return this.drop(topic, 'device is not registered');

    return HANDLERS[kind](deviceId, message);
  }

  drop(topic, reason) {
    console.warn(`MQTT dropped ${topic}: ${reason}`);
  }
}

module.exports = new MqttSubscriberService();
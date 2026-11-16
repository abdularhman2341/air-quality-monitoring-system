const mqtt = require('mqtt');
const Device = require('../models/Device');
const readingService = require('./ReadingService');
const alertService = require('./AlertService');
const deviceService = require('./DeviceService');

// Devices publish to aqms/devices/{MAC}/{readings|alarms|status}. The MAC is
// the device id: 12 upper-case hex characters, no colons. The broker ACL lets
// each device write only under its own MAC, so the topic proves the sender.
const DEVICE_TOPICS = 'aqms/devices/+/#';
const TOPIC_PATTERN = /^aqms\/devices\/([0-9A-F]{12})\/(readings|alarms|status)$/;

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isTimestamp = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));

// One check per topic kind. Each returns what is wrong as text, or null when
// the message is fine. Only the fields the backend relies on are required;
// the optional sensor fields are stored as null when missing (Reading.record).
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

// What a valid message from a registered device does. ownerId is null while
// no user has linked the device: the data is still saved, but no live event
// is sent (RealtimeGateway.emitToOwner skips it).
const HANDLERS = {
  readings: (deviceId, message, ownerId) => readingService.processTelemetry(deviceId, message, ownerId),
  alarms: (deviceId, message, ownerId) => alertService.handleAlarmEvent(deviceId, message, ownerId),
  status: (deviceId, message, ownerId) => deviceService.updateDeviceStatus(deviceId, message.state, ownerId),
};

class MqttSubscriberService {
  // clean: false keeps this backend's session on the broker, so QoS 1
  // messages that arrive while the backend is down wait there and come in
  // after it reconnects. The broker holds them in memory only (persistence
  // false in mosquitto/docker-entrypoint.sh): a broker restart loses them.
  // The production broker uses the username as the client id
  // (use_username_as_clientid), so MQTT_CLIENT_ID only matters on the local
  // broker. Two backends must never share one id: the broker would drop the
  // older connection.
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
    // MQTT.js calls client.handleMessage for every incoming message and sends
    // the QoS 1 acknowledgement (PUBACK) only when done() is called, never on
    // done(err). Replacing it means a message is acknowledged only after it is
    // saved. The library passes the next message only after done(), so
    // messages are handled one at a time, in arrival order.
    // On a failure the connection is closed on purpose: the broker resends an
    // unacknowledged message only after a reconnect, and stops sending once
    // 20 are waiting (Mosquitto's max_inflight_messages). reconnectPeriod
    // reconnects after 5 s, and the waiting messages arrive in order.
    this.client.handleMessage = (packet, done) => {
      this.handleMessage(packet.topic, packet.payload).then(
        () => done(),
        (err) => {
          console.error(`MQTT ${packet.topic}: ${err.message}`);
          done(err);
          this.client.stream.destroy();
        },
      );
    };
  }

  // Shown by GET /api/v1/health. 'disabled' means MQTT_URL is not set.
  get status() {
    if (!this.client) return 'disabled';
    return this.client.connected ? 'connected' : 'disconnected';
  }

  subscribe(topic) {
    this.client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) console.error(`MQTT subscribe failed: ${err.message}`);
    });
  }

  // Checks one message and hands it to its handler. A message that can never
  // be valid is dropped: logged, then acknowledged like a good one, because
  // the broker would otherwise resend it forever. An error from the database
  // is not caught here, so the message is not acknowledged and comes back.
  // The tests call this method directly, without a broker.
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
    const ownerId = await Device.findOwnerId(deviceId);
    if (ownerId === undefined) return this.drop(topic, 'device is not registered');

    return HANDLERS[kind](deviceId, message, ownerId);
  }

  drop(topic, reason) {
    console.warn(`MQTT dropped ${topic}: ${reason}`);
  }
}

module.exports = new MqttSubscriberService();
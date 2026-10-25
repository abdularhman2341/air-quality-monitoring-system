require('dotenv').config({ quiet: true });
const readline = require('readline');
const mqtt = require('mqtt');

const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const DEVICE_ID = (process.argv[2] || 'A4CF123B9E01').replace(/[:-]/g, '').toUpperCase();
const INTERVAL_MS = Number(process.env.SIM_INTERVAL_MS) || 5000;
const THRESHOLD_PPM = 1000;
const BASE_PPM = 120;
const LEAK_PEAK_PPM = 1500;
const LEAK_STEP_PPM = 350;
const LEAK_HOLD_READINGS = 3;

const topic = (name) => `aqms/devices/${DEVICE_ID}/${name}`;
const now = () => new Date().toISOString();

let seq = 0;
let ppm = BASE_PPM;
let alarmActive = false;
let leak = null;

const client = mqtt.connect(MQTT_URL, {
  clientId: `aqms-${DEVICE_ID}`,
  username: process.env.SIM_MQTT_USERNAME,
  password: process.env.SIM_MQTT_PASSWORD,
  will: {
    topic: topic('status'),
    payload: JSON.stringify({ device_id: DEVICE_ID, state: 'offline', ts: now() }),
    qos: 1,
    retain: true,
  },
});

function publish(name, message, options = {}) {
  const payload = JSON.stringify({ device_id: DEVICE_ID, ...message, ts: now() });
  client.publish(topic(name), payload, { qos: 1, ...options });
  console.log(`-> ${name} ${payload}`);
}

function nextPpm() {
  if (leak === 'rising') {
    ppm = Math.min(ppm + LEAK_STEP_PPM, LEAK_PEAK_PPM);
    if (ppm === LEAK_PEAK_PPM) leak = LEAK_HOLD_READINGS;
  } else if (typeof leak === 'number') {
    leak -= 1;
    if (leak === 0) leak = 'falling';
  } else if (leak === 'falling') {
    ppm = Math.max(ppm - LEAK_STEP_PPM, BASE_PPM);
    if (ppm === BASE_PPM) leak = null;
  } else {
    ppm = BASE_PPM + Math.round((Math.random() - 0.5) * 30);
  }
  return ppm;
}

function sendReading() {
  const value = nextPpm();
  if (value >= THRESHOLD_PPM && !alarmActive) {
    alarmActive = true;
    publish('alarms', { event: 'alarm_on', lpg_ppm_est: value, threshold_ppm: THRESHOLD_PPM });
  } else if (value < THRESHOLD_PPM && alarmActive) {
    alarmActive = false;
    publish('alarms', { event: 'alarm_off', lpg_ppm_est: value, threshold_ppm: THRESHOLD_PPM });
  }

  seq += 1;
  const adc = Math.min(4095, Math.round(800 + value * 0.8));
  publish('readings', {
    seq,
    sensor_raw_adc: adc,
    sensor_voltage: Number(((adc / 4095) * 3.3).toFixed(2)),
    rs_ro_ratio: Number(Math.max(0.1, 1.2 - value / 2000).toFixed(2)),
    lpg_ppm_est: value,
    alarm_active: alarmActive,
  });
}

client.on('connect', () => {
  console.log(`Connected to ${MQTT_URL} as aqms-${DEVICE_ID}`);
  console.log('Type "l" + Enter to start a gas leak, "q" + Enter to stop the device.');
  publish('status', { state: 'online', ip: '127.0.0.1' }, { retain: true });
  sendReading();
  setInterval(sendReading, INTERVAL_MS);
});

client.on('error', (err) => {
  console.error(`MQTT error: ${err.message}`);
});

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const command = line.trim().toLowerCase();
  if (command === 'l' && leak === null) {
    leak = 'rising';
    console.log('Gas leak started');
  } else if (command === 'q') {
    publish('status', { state: 'offline' }, { retain: true });
    client.end(false, () => process.exit(0));
  }
});
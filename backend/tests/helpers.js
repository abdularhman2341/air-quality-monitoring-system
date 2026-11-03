const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/db/prisma');
const mqttSubscriber = require('../src/services/MqttSubscriberService');

const api = () => request(app);

async function resetDatabase() {
  await prisma.$executeRawUnsafe('TRUNCATE alerts, readings, devices, sessions, users RESTART IDENTITY CASCADE');
}

let userCount = 0;

async function signUp(name = 'Test User') {
  userCount += 1;
  const email = `user${userCount}@test.local`;
  const password = 'password123';
  await api().post('/api/v1/auth/register').send({ name, email, password }).expect(201);
  const res = await api().post('/api/v1/auth/login').send({ email, password }).expect(200);
  return { email, password, token: res.body.token, auth: { Authorization: `Bearer ${res.body.token}` } };
}

async function registerDevice(deviceId, pairingCode = 'ABCD-EFGH') {
  const pairing_code_hash = await bcrypt.hash(pairingCode, 4);
  await prisma.device.create({ data: { device_id: deviceId, pairing_code_hash } });
  return pairingCode;
}

async function linkDevice(user, deviceId, pairingCode) {
  return api()
    .post('/api/v1/devices')
    .set(user.auth)
    .send({ mac_address: deviceId, pairing_code: pairingCode, name: 'Kitchen' })
    .expect(201);
}

function publish(deviceId, kind, fields) {
  const payload = Buffer.from(JSON.stringify({ device_id: deviceId, ...fields }));
  return mqttSubscriber.handleMessage(`aqms/devices/${deviceId}/${kind}`, payload);
}

module.exports = { api, prisma, resetDatabase, signUp, registerDevice, linkDevice, publish };

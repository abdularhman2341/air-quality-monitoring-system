const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/db/prisma');
const mqttSubscriber = require('../src/services/MqttSubscriberService');
const mailService = require('../src/services/MailService');

const api = () => request(app);

async function resetDatabase() {
  await prisma.$executeRawUnsafe('TRUNCATE rate_limit_hits, verification_codes, admin_actions, alerts, readings, devices, sessions, users RESTART IDENTITY CASCADE');
}

let userCount = 0;

// Sign-up emails a code after the response. The helper waits for that email
// and takes it out of the outbox, so a test sees only the emails it caused.
// A verified account (the default) is activated in the database and signed
// in; an unverified one has no session (it cannot sign in before its code).
async function takeVerificationMail(email) {
  for (let i = 0; i < 200; i += 1) {
    const index = mailService.outbox.findIndex((mail) => mail.to === email && mail.subject.includes('verification code'));
    if (index !== -1) {
      return mailService.outbox.splice(index, 1)[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`No verification email arrived for ${email}.`);
}

async function signUp(name = 'Test User', { verified = true } = {}) {
  userCount += 1;
  const email = `user${userCount}@test.local`;
  const password = 'password123';
  await api().post('/api/v1/auth/register').send({ name, email, password }).expect(202);
  if (!verified) {
    return { email, password };
  }
  await takeVerificationMail(email);
  await prisma.verificationCode.deleteMany({ where: { purpose: 'verify_email', user: { email } } });
  await prisma.user.update({ where: { email }, data: { email_verified_at: new Date() } });
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

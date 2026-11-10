const {
  api, prisma, resetDatabase, signUp, registerDevice, linkDevice, publish,
} = require('./helpers');
const mailService = require('../src/services/MailService');

const MAC = 'AAAAAAAAAA07';
let user;

beforeEach(async () => {
  await resetDatabase();
  mailService.clearOutbox();
  user = await signUp('Sara');
  const code = await registerDevice(MAC);
  await linkDevice(user, MAC, code);
  await prisma.device.update({ where: { device_id: MAC }, data: { location: 'Floor 1' } });
});
afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.APP_URL;
});
afterAll(() => prisma.$disconnect());

const pause = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => new Date().toISOString();
const alarm = (event, ppm) => ({ event, lpg_ppm_est: ppm, threshold_ppm: 1000, ts: now() });

// Alert emails are sent after the message is handled, so give them a moment.
async function waitForMail(count) {
  for (let i = 0; i < 100 && mailService.outbox.length < count; i += 1) {
    await pause(10);
  }
  return mailService.outbox;
}

async function forgetLastEmail() {
  await prisma.$executeRawUnsafe("UPDATE devices SET alert_email_at = alert_email_at - interval '11 minutes'");
}

describe('when an alarm starts', () => {
  test('the owner gets an email with the device, the reading and what to do', async () => {
    process.env.APP_URL = 'https://example.test/';
    await publish(MAC, 'alarms', alarm('alarm_on', 1420));
    const [mail] = await waitForMail(1);

    expect(mail.to).toBe(user.email);
    expect(mail.subject).toContain('Gas leak alert');
    expect(mail.subject).toContain('Kitchen');
    expect(mail.text).toContain('Kitchen');
    expect(mail.text).toContain('Floor 1');
    expect(mail.text).toContain('1420');
    expect(mail.text).toContain('1000');
    expect(mail.text).toContain('998');
    expect(mail.text).toContain('https://example.test\n');
    expect((await prisma.alert.findFirst()).email_sent).toBe(true);
  });

  test('the email has no link when APP_URL is not set', async () => {
    await publish(MAC, 'alarms', alarm('alarm_on', 1420));
    const [mail] = await waitForMail(1);
    expect(mail.text).not.toContain('http');
  });

  test('a repeated alarm_on sends one email', async () => {
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    await publish(MAC, 'alarms', alarm('alarm_on', 1300));
    await pause();
    expect(mailService.outbox).toHaveLength(1);
  });

  test('an account with an unverified email gets nothing', async () => {
    await prisma.user.updateMany({ data: { email_verified_at: null } });
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    await pause();
    expect(mailService.outbox).toEqual([]);
    expect(await prisma.alert.count()).toBe(1);
  });

  test('an account that turned alert emails off gets nothing', async () => {
    const res = await api().patch('/api/v1/auth/me').set(user.auth).send({ alert_emails: false }).expect(200);
    expect(res.body).toMatchObject({ alert_emails: false, name: 'Sara' });
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    await pause();
    expect(mailService.outbox).toEqual([]);
  });

  test('a device without an owner sends nothing', async () => {
    await registerDevice('AAAAAAAAAA08');
    await publish('AAAAAAAAAA08', 'alarms', alarm('alarm_on', 1200));
    await pause();
    expect(mailService.outbox).toEqual([]);
    expect(await prisma.alert.count()).toBe(1);
  });

  test('a failed email does not stop the alert from being saved, and is logged', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(mailService, 'send').mockRejectedValue(new Error('provider down'));
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    await pause();
    expect(await prisma.alert.count()).toBe(1);
    expect(logged.mock.calls.map((call) => call.join(' ')).join('\n')).toContain('Mail not sent (gas alert): provider down');
  });

  test('handling the message does not wait for the mail provider', async () => {
    jest.spyOn(mailService, 'send').mockImplementation(() => new Promise(() => {}));
    const started = Date.now();
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    await publish(MAC, 'readings', { lpg_ppm_est: 1500, alarm_active: true, ts: now() });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(await prisma.reading.count()).toBe(1);
  });
});

describe('when the alarm ends', () => {
  test('the owner gets a second email with the peak', async () => {
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    await publish(MAC, 'readings', { lpg_ppm_est: 1750, alarm_active: true, ts: now() });
    await waitForMail(1);
    await publish(MAC, 'alarms', alarm('alarm_off', 700));
    const outbox = await waitForMail(2);

    expect(outbox).toHaveLength(2);
    expect(outbox[1].to).toBe(user.email);
    expect(outbox[1].subject).toContain('Gas alert ended');
    expect(outbox[1].text).toContain('Kitchen');
    expect(outbox[1].text).toContain('1750');
  });

  test('no end email when the start email was not sent', async () => {
    await api().patch('/api/v1/auth/me').set(user.auth).send({ alert_emails: false }).expect(200);
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    await api().patch('/api/v1/auth/me').set(user.auth).send({ alert_emails: true }).expect(200);
    await publish(MAC, 'alarms', alarm('alarm_off', 700));
    await pause();
    expect(mailService.outbox).toEqual([]);
  });
});

describe('at most one alert email per device every 10 minutes', () => {
  test('a second alarm soon after sends nothing, start or end', async () => {
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    await publish(MAC, 'alarms', alarm('alarm_off', 700));
    await waitForMail(2);
    mailService.clearOutbox();

    await publish(MAC, 'alarms', alarm('alarm_on', 1300));
    await publish(MAC, 'alarms', alarm('alarm_off', 600));
    await pause();
    expect(mailService.outbox).toEqual([]);
    expect(await prisma.alert.count()).toBe(2);
  });

  test('after 10 minutes the next alarm sends an email again', async () => {
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    await publish(MAC, 'alarms', alarm('alarm_off', 700));
    await waitForMail(2);
    mailService.clearOutbox();
    await forgetLastEmail();

    await publish(MAC, 'alarms', alarm('alarm_on', 1300));
    expect(await waitForMail(1)).toHaveLength(1);
  });

  test('the limit is per device', async () => {
    const other = 'AAAAAAAAAA09';
    const code = await registerDevice(other);
    await linkDevice(user, other, code);
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    await publish(other, 'alarms', alarm('alarm_on', 1200));
    expect(await waitForMail(2)).toHaveLength(2);
  });
});

describe('the alert emails setting', () => {
  test('is on for a new account and shown in the profile', async () => {
    const res = await api().get('/api/v1/auth/me').set(user.auth).expect(200);
    expect(res.body.alert_emails).toBe(true);
  });

  test('can be changed alone, with the name, and must be true or false', async () => {
    const both = await api().patch('/api/v1/auth/me').set(user.auth).send({ name: 'Sara A', alert_emails: false }).expect(200);
    expect(both.body).toMatchObject({ name: 'Sara A', alert_emails: false });
    const nameOnly = await api().patch('/api/v1/auth/me').set(user.auth).send({ name: 'Sara B' }).expect(200);
    expect(nameOnly.body).toMatchObject({ name: 'Sara B', alert_emails: false });
    const bad = await api().patch('/api/v1/auth/me').set(user.auth).send({ alert_emails: 'no' }).expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    const empty = await api().patch('/api/v1/auth/me').set(user.auth).send({}).expect(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');
  });
});

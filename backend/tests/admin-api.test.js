const { api, prisma, resetDatabase, signUp, registerDevice, linkDevice, publish } = require('./helpers');
const { makeAdmin } = require('../src/scripts/makeAdmin');
const realtimeGateway = require('../src/services/RealtimeGateway');

beforeEach(resetDatabase);
afterEach(() => jest.restoreAllMocks());
afterAll(() => prisma.$disconnect());

const ADMIN = '/api/v1/admin';
const MAC = 'AAAAAAAAAA10';
const now = () => new Date().toISOString();

async function signUpAdmin(name = 'Admin') {
  const user = await signUp(name);
  await makeAdmin(user.email);
  return user;
}

async function idOf(user) {
  const me = await api().get('/api/v1/auth/me').set(user.auth).expect(200);
  return me.body.id;
}

async function ownedDevice(owner, mac = MAC) {
  const code = await registerDevice(mac);
  await linkDevice(owner, mac, code);
  await publish(mac, 'readings', { lpg_ppm_est: 120, alarm_active: false, ts: now() });
  return code;
}

async function lastAction() {
  return prisma.adminAction.findFirst({ orderBy: { id: 'desc' } });
}

describe('every admin route', () => {
  const routes = [
    ['get', '/actions'],
    ['get', '/users'],
    ['get', '/users/1'],
    ['patch', '/users/1'],
    ['delete', '/users/1'],
    ['post', '/users/1/logout-all'],
    ['post', '/users/1/password-reset'],
    ['get', '/devices'],
    ['post', '/devices'],
    ['get', `/devices/${MAC}`],
    ['patch', `/devices/${MAC}`],
    ['delete', `/devices/${MAC}`],
    ['post', `/devices/${MAC}/pairing-code`],
    ['get', `/devices/${MAC}/readings`],
    ['get', '/alerts'],
    ['post', '/alerts/1/close'],
  ];

  test('refuses a normal user with 403 and changes nothing', async () => {
    const user = await signUp();
    for (const [method, path] of routes) {
      const res = await api()[method](`${ADMIN}${path}`).set(user.auth).send({});
      expect([method, path, res.status]).toEqual([method, path, 403]);
    }
    expect(await prisma.user.count()).toBe(1);
  });
});

describe('users', () => {
  test('lists every account with its device count, and searches by name or email', async () => {
    const admin = await signUpAdmin();
    const owner = await signUp('Sara Owner');
    await ownedDevice(owner);

    const all = await api().get(`${ADMIN}/users`).set(admin.auth).expect(200);
    expect(all.body.total).toBe(2);
    expect(all.body.data.map((u) => [u.name, u.role, u.device_count])).toEqual([
      ['Admin', 'admin', 0],
      ['Sara Owner', 'user', 1],
    ]);
    expect(all.body.data[0].password_hash).toBeUndefined();

    const byName = await api().get(`${ADMIN}/users?q=sara`).set(admin.auth).expect(200);
    expect(byName.body.data.map((u) => u.email)).toEqual([owner.email]);
    const byEmail = await api().get(`${ADMIN}/users?q=${owner.email.toUpperCase()}`).set(admin.auth).expect(200);
    expect(byEmail.body.total).toBe(1);
  });

  test('shows one account with its devices, and 404 for an unknown one', async () => {
    const admin = await signUpAdmin();
    const owner = await signUp();
    await ownedDevice(owner);
    const id = await idOf(owner);

    const res = await api().get(`${ADMIN}/users/${id}`).set(admin.auth).expect(200);
    expect(res.body.user.email).toBe(owner.email);
    expect(res.body.devices.map((d) => d.device_id)).toEqual([MAC]);

    for (const bad of ['999999', 'abc', '1.5']) {
      const missing = await api().get(`${ADMIN}/users/${bad}`).set(admin.auth).expect(404);
      expect(missing.body.error.code).toBe('USER_NOT_FOUND');
    }
  });

  test('edits name, email and role, and logs each change with its old value', async () => {
    const admin = await signUpAdmin();
    const user = await signUp('Old Name');
    const id = await idOf(user);

    const res = await api()
      .patch(`${ADMIN}/users/${id}`)
      .set(admin.auth)
      .send({ name: ' New Name ', email: 'NEW@Test.local', role: 'admin' })
      .expect(200);
    expect(res.body).toMatchObject({ name: 'New Name', email: 'new@test.local', role: 'admin' });

    const action = await lastAction();
    expect(action).toMatchObject({ admin_email: admin.email, action: 'user.update', target_id: id });
    expect(action.details).toEqual({
      name: { from: 'Old Name', to: 'New Name' },
      email: { from: user.email, to: 'new@test.local' },
      role: { from: 'user', to: 'admin' },
    });
    await api().get(`${ADMIN}/actions`).set(user.auth).expect(200);
  });

  test('refuses a taken email, a wrong role and an empty body', async () => {
    const admin = await signUpAdmin();
    const user = await signUp();
    const id = await idOf(user);

    const taken = await api().patch(`${ADMIN}/users/${id}`).set(admin.auth).send({ email: admin.email }).expect(409);
    expect(taken.body.error.code).toBe('EMAIL_TAKEN');
    await api().patch(`${ADMIN}/users/${id}`).set(admin.auth).send({ role: 'owner' }).expect(400);
    await api().patch(`${ADMIN}/users/${id}`).set(admin.auth).send({}).expect(400);
    expect(await prisma.adminAction.count()).toBe(1);
  });

  test('the last admin cannot demote themselves; with a second admin they can', async () => {
    const admin = await signUpAdmin();
    const id = await idOf(admin);

    const res = await api().patch(`${ADMIN}/users/${id}`).set(admin.auth).send({ role: 'user' }).expect(409);
    expect(res.body.error.code).toBe('LAST_ADMIN');

    const other = await signUp();
    await api().patch(`${ADMIN}/users/${await idOf(other)}`).set(admin.auth).send({ role: 'admin' }).expect(200);
    await api().patch(`${ADMIN}/users/${id}`).set(admin.auth).send({ role: 'user' }).expect(200);
    await api().get(`${ADMIN}/users`).set(admin.auth).expect(403);
  });

  test('deletes an account: its sessions end, its devices are released, the log stays', async () => {
    const admin = await signUpAdmin();
    const owner = await signUp();
    const code = await ownedDevice(owner);
    const id = await idOf(owner);
    const disconnectUser = jest.spyOn(realtimeGateway, 'disconnectUser');

    await api().delete(`${ADMIN}/users/${id}`).set(admin.auth).expect(204);

    await api().get('/api/v1/auth/me').set(owner.auth).expect(401);
    expect(disconnectUser).toHaveBeenCalledWith(id);
    expect(await prisma.reading.count()).toBe(0);
    expect((await prisma.device.findUnique({ where: { device_id: MAC } })).owner_id).toBeNull();
    expect(await lastAction()).toMatchObject({ action: 'user.delete', target_id: id, target_label: owner.email });

    const next = await signUp();
    await linkDevice(next, MAC, code);
  });

  test('an admin deleting their own account keeps their log entries', async () => {
    const admin = await signUpAdmin('First');
    await signUpAdmin('Second');
    const id = await idOf(admin);

    await api().delete(`${ADMIN}/users/${id}`).set(admin.auth).expect(204);

    const action = await lastAction();
    expect(action).toMatchObject({ admin_id: null, admin_email: admin.email, action: 'user.delete' });
  });

  test('the last admin cannot be deleted', async () => {
    const admin = await signUpAdmin();
    const res = await api().delete(`${ADMIN}/users/${await idOf(admin)}`).set(admin.auth).expect(409);
    expect(res.body.error.code).toBe('LAST_ADMIN');
  });

  test('signs an account out of every device, without touching the admin', async () => {
    const admin = await signUpAdmin();
    const user = await signUp();
    const id = await idOf(user);
    const disconnectUser = jest.spyOn(realtimeGateway, 'disconnectUser');

    await api().post(`${ADMIN}/users/${id}/logout-all`).set(admin.auth).expect(204);

    const ended = await api().get('/api/v1/auth/me').set(user.auth).expect(401);
    expect(ended.body.error.code).toBe('SESSION_ENDED');
    expect(disconnectUser).toHaveBeenCalledWith(id);
    await api().get('/api/v1/auth/me').set(admin.auth).expect(200);
    expect(await lastAction()).toMatchObject({ action: 'user.logout_all', target_id: id });
  });
});

describe('devices', () => {
  test('registers a device and shows its pairing code once; the code links it', async () => {
    const admin = await signUpAdmin();
    const res = await api()
      .post(`${ADMIN}/devices`)
      .set(admin.auth)
      .send({ mac_address: 'aa:aa:aa:aa:aa:10', name: 'Unit 10' })
      .expect(201);

    expect(res.body.device).toMatchObject({ device_id: MAC, name: 'Unit 10', owner: null });
    expect(res.body.pairing_code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);

    const stored = await prisma.device.findUnique({ where: { device_id: MAC } });
    expect(stored.pairing_code_hash).not.toContain(res.body.pairing_code);
    const action = await lastAction();
    expect(action).toMatchObject({ action: 'device.create', target_id: MAC });
    expect(JSON.stringify(action)).not.toContain(res.body.pairing_code);

    const listed = await api().get(`${ADMIN}/devices/${MAC}`).set(admin.auth).expect(200);
    expect(listed.body.pairing_code).toBeUndefined();

    const user = await signUp();
    await linkDevice(user, MAC, res.body.pairing_code);
  });

  test('refuses a MAC that exists or is not valid', async () => {
    const admin = await signUpAdmin();
    await registerDevice(MAC);
    const exists = await api().post(`${ADMIN}/devices`).set(admin.auth).send({ mac_address: MAC }).expect(409);
    expect(exists.body.error.code).toBe('DEVICE_EXISTS');
    const invalid = await api().post(`${ADMIN}/devices`).set(admin.auth).send({ mac_address: 'XYZ' }).expect(400);
    expect(invalid.body.error.code).toBe('INVALID_MAC');
  });

  test('lists every device with its owner, and searches by MAC or owner email', async () => {
    const admin = await signUpAdmin();
    const owner = await signUp();
    await ownedDevice(owner);
    await registerDevice('BBBBBBBBBB20');

    const all = await api().get(`${ADMIN}/devices`).set(admin.auth).expect(200);
    expect(all.body.total).toBe(2);
    const byId = Object.fromEntries(all.body.data.map((d) => [d.device_id, d]));
    expect(byId[MAC].owner.email).toBe(owner.email);
    expect(byId[MAC].latest.lpg_ppm_est).toBe(120);
    expect(byId.BBBBBBBBBB20.owner).toBeNull();

    const byMac = await api().get(`${ADMIN}/devices?q=bb:bb`).set(admin.auth).expect(200);
    expect(byMac.body.data.map((d) => d.device_id)).toEqual(['BBBBBBBBBB20']);
    const byOwner = await api().get(`${ADMIN}/devices?q=${owner.email}`).set(admin.auth).expect(200);
    expect(byOwner.body.data.map((d) => d.device_id)).toEqual([MAC]);
  });

  test('renaming keeps the history', async () => {
    const admin = await signUpAdmin();
    const owner = await signUp();
    await ownedDevice(owner);

    const res = await api().patch(`${ADMIN}/devices/${MAC}`).set(admin.auth).send({ name: 'Garage', location: 'Floor 2' }).expect(200);
    expect(res.body).toMatchObject({ name: 'Garage', location: 'Floor 2' });
    expect(await prisma.reading.count()).toBe(1);
    expect((await lastAction()).details).toMatchObject({ name: { from: 'Kitchen', to: 'Garage' }, history_deleted: false });
  });

  test('moving a device to another owner deletes its history', async () => {
    const admin = await signUpAdmin();
    const first = await signUp();
    const second = await signUp();
    await ownedDevice(first);
    const secondId = await idOf(second);

    const res = await api().patch(`${ADMIN}/devices/${MAC}`).set(admin.auth).send({ owner_id: secondId }).expect(200);
    expect(res.body.owner.id).toBe(secondId);
    expect((await lastAction()).details.owner).toEqual({ from: first.email, to: second.email });

    expect(await prisma.reading.count()).toBe(0);
    await api().get(`/api/v1/devices/${MAC}`).set(first.auth).expect(404);
    await api().get(`/api/v1/devices/${MAC}`).set(second.auth).expect(200);
    expect((await lastAction()).details).toMatchObject({ history_deleted: true });
  });

  test('removing the owner frees the device; an unknown owner is refused', async () => {
    const admin = await signUpAdmin();
    const owner = await signUp();
    const code = await ownedDevice(owner);

    const unknown = await api().patch(`${ADMIN}/devices/${MAC}`).set(admin.auth).send({ owner_id: '999999' }).expect(404);
    expect(unknown.body.error.code).toBe('USER_NOT_FOUND');

    const res = await api().patch(`${ADMIN}/devices/${MAC}`).set(admin.auth).send({ owner_id: null }).expect(200);
    expect(res.body.owner).toBeNull();
    const next = await signUp();
    await linkDevice(next, MAC, code);
  });

  test('deletes a device with its history; its messages are then dropped', async () => {
    const admin = await signUpAdmin();
    const owner = await signUp();
    await ownedDevice(owner);

    await api().delete(`${ADMIN}/devices/${MAC}`).set(admin.auth).expect(204);

    expect(await prisma.device.count()).toBe(0);
    expect(await prisma.reading.count()).toBe(0);
    await publish(MAC, 'readings', { lpg_ppm_est: 5, alarm_active: false, ts: now() });
    expect(await prisma.reading.count()).toBe(0);
    const mine = await api().get('/api/v1/devices').set(owner.auth).expect(200);
    expect(mine.body).toEqual([]);
    expect(await lastAction()).toMatchObject({ action: 'device.delete', target_id: MAC });
    await api().delete(`${ADMIN}/devices/${MAC}`).set(admin.auth).expect(404);
  });

  test('a new pairing code replaces the old one', async () => {
    const admin = await signUpAdmin();
    const oldCode = await registerDevice(MAC);

    const res = await api().post(`${ADMIN}/devices/${MAC}/pairing-code`).set(admin.auth).expect(200);
    expect(res.body.pairing_code).not.toBe(oldCode);

    const user = await signUp();
    await api().post('/api/v1/devices').set(user.auth)
      .send({ mac_address: MAC, pairing_code: oldCode, name: 'Kitchen' }).expect(404);
    await linkDevice(user, MAC, res.body.pairing_code);
    expect(JSON.stringify(await prisma.adminAction.findMany())).not.toContain(res.body.pairing_code);
  });

  test('reads the readings of any device', async () => {
    const admin = await signUpAdmin();
    const owner = await signUp();
    await ownedDevice(owner);

    const res = await api().get(`${ADMIN}/devices/${MAC}/readings?limit=10`).set(admin.auth).expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].lpg_ppm_est).toBe(120);
    await api().get(`${ADMIN}/devices/BBBBBBBBBB20/readings`).set(admin.auth).expect(404);
  });
});

describe('alerts', () => {
  const alarm = (event, ppm) => ({ event, lpg_ppm_est: ppm, threshold_ppm: 1000, ts: now() });

  test('lists alerts of every account, and only open ones on request', async () => {
    const admin = await signUpAdmin();
    const first = await signUp();
    const second = await signUp();
    await ownedDevice(first, MAC);
    await ownedDevice(second, 'BBBBBBBBBB20');
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    await publish(MAC, 'alarms', alarm('alarm_off', 600));
    await publish('BBBBBBBBBB20', 'alarms', alarm('alarm_on', 1500));

    const all = await api().get(`${ADMIN}/alerts`).set(admin.auth).expect(200);
    expect(all.body.total).toBe(2);
    const open = await api().get(`${ADMIN}/alerts?status=open`).set(admin.auth).expect(200);
    expect(open.body.data).toHaveLength(1);
    expect(open.body.data[0]).toMatchObject({ device_id: 'BBBBBBBBBB20', ended_at: null });
    expect(open.body.data[0].device.owner.email).toBe(second.email);
    await api().get(`${ADMIN}/alerts?status=maybe`).set(admin.auth).expect(400);
  });

  test('closes a stuck alert, tells the owner, and a new alarm opens a new alert', async () => {
    const admin = await signUpAdmin();
    const owner = await signUp();
    await ownedDevice(owner);
    await publish(MAC, 'alarms', alarm('alarm_on', 1200));
    const alert = await prisma.alert.findFirst();
    const emit = jest.spyOn(realtimeGateway, 'emitToOwner');

    const res = await api().post(`${ADMIN}/alerts/${alert.id}/close`).set(admin.auth).expect(200);
    expect(res.body.ended_at).not.toBeNull();
    expect(emit).toHaveBeenCalledWith(Number(await idOf(owner)), 'alert:new', expect.objectContaining({ id: alert.id }));
    expect(await lastAction()).toMatchObject({ action: 'alert.close', target_id: String(alert.id), target_label: MAC });

    const again = await api().post(`${ADMIN}/alerts/${alert.id}/close`).set(admin.auth).expect(409);
    expect(again.body.error.code).toBe('ALERT_ALREADY_CLOSED');
    await api().post(`${ADMIN}/alerts/999999/close`).set(admin.auth).expect(404);

    await publish(MAC, 'alarms', alarm('alarm_on', 1300));
    expect(await prisma.alert.count()).toBe(2);
  });
});

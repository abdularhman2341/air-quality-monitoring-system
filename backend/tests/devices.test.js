const { api, prisma, resetDatabase, signUp, registerDevice, linkDevice, publish } = require('./helpers');

const MAC = 'AAAAAAAAAA02';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('linking a device', () => {
  test('accepts the MAC with colons and stores it without them', async () => {
    const user = await signUp();
    const code = await registerDevice(MAC);
    const res = await api()
      .post('/api/v1/devices')
      .set(user.auth)
      .send({ mac_address: 'aa:aa:aa:aa:aa:02', pairing_code: code, name: 'Kitchen' })
      .expect(201);
    expect(res.body.device_id).toBe(MAC);
  });

  test('wrong pairing code returns 404', async () => {
    const user = await signUp();
    await registerDevice(MAC);
    const res = await api()
      .post('/api/v1/devices')
      .set(user.auth)
      .send({ mac_address: MAC, pairing_code: 'WRONG-CODE', name: 'Kitchen' })
      .expect(404);
    expect(res.body.error.code).toBe('DEVICE_NOT_FOUND');
  });

  test('a device already linked to another account returns 409', async () => {
    const owner = await signUp();
    const other = await signUp();
    const code = await registerDevice(MAC);
    await linkDevice(owner, MAC, code);
    const res = await api()
      .post('/api/v1/devices')
      .set(other.auth)
      .send({ mac_address: MAC, pairing_code: code, name: 'Kitchen' })
      .expect(409);
    expect(res.body.error.code).toBe('DEVICE_ALREADY_LINKED');
  });
});

describe('data isolation (O3)', () => {
  test("another account gets 404 for the device, its readings, and its alerts", async () => {
    const owner = await signUp();
    const other = await signUp();
    const code = await registerDevice(MAC);
    await linkDevice(owner, MAC, code);

    await api().get(`/api/v1/devices/${MAC}`).set(other.auth).expect(404);
    await api().get(`/api/v1/devices/${MAC}/readings`).set(other.auth).expect(404);
    await api().get(`/api/v1/devices/${MAC}/alerts`).set(other.auth).expect(404);
    await api().delete(`/api/v1/devices/${MAC}`).set(other.auth).expect(404);

    const list = await api().get('/api/v1/devices').set(other.auth).expect(200);
    expect(list.body).toHaveLength(0);
  });
});

describe('removing a device', () => {
  test('unlinks it, deletes its history, and lets it be linked again with the same code', async () => {
    const owner = await signUp();
    const next = await signUp();
    const code = await registerDevice(MAC);
    await linkDevice(owner, MAC, code);
    await publish(MAC, 'readings', { lpg_ppm_est: 300, alarm_active: false, ts: new Date().toISOString() });

    await api().delete(`/api/v1/devices/${MAC}`).set(owner.auth).expect(204);

    expect(await prisma.reading.count()).toBe(0);
    await linkDevice(next, MAC, code);
    const res = await api().get(`/api/v1/devices/${MAC}/readings`).set(next.auth).expect(200);
    expect(res.body.total).toBe(0);
  });
});

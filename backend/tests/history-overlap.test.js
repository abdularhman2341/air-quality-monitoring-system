const { api, prisma, resetDatabase, signUp, registerDevice, linkDevice } = require('./helpers');

const MAC = 'AAAAAAAAAA07';
const FROM = '2026-11-10T00:00:00Z';
const TO = '2026-11-20T00:00:00Z';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

function alertAt(id, startedAt, endedAt) {
  return prisma.alert.create({
    data: {
      id, device_id: MAC, started_at: new Date(startedAt), ended_at: endedAt && new Date(endedAt),
      peak_lpg_ppm_est: 1200, threshold_ppm: 1000,
    },
  });
}

// F14: History asks for "the last N days" with ?from=. A leak that started
// before that and is still going (or ended inside the range) vanished,
// because only started_at was compared with `from`.
describe('alerts that overlap the range (F14)', () => {
  let user;
  beforeEach(async () => {
    user = await signUp();
    await linkDevice(user, MAC, await registerDevice(MAC));
    await alertAt(1, '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z'); // ended before the range
    await alertAt(2, '2026-11-05T00:00:00Z', null); // started before, still open
    await alertAt(3, '2026-11-08T00:00:00Z', '2026-11-12T00:00:00Z'); // started before, ended inside
    await alertAt(4, '2026-11-15T00:00:00Z', '2026-11-15T01:00:00Z'); // inside
    await alertAt(5, '2026-11-25T00:00:00Z', '2026-11-25T01:00:00Z'); // starts after `to` (one open alert per device)
    await alertAt(6, '2026-11-09T00:00:00Z', FROM); // ends exactly at `from`
  });

  const ids = (res) => res.body.data.map((a) => a.id);

  test('?from= shows every alert still going at or after it, newest first', async () => {
    const res = await api().get('/api/v1/alerts').query({ from: FROM }).set(user.auth).expect(200);
    expect(ids(res)).toEqual([5, 4, 6, 3, 2]);
    expect(res.body.total).toBe(5);
  });

  test('?from=&to= keeps alerts that overlap the window only', async () => {
    const res = await api().get('/api/v1/alerts').query({ from: FROM, to: TO }).set(user.auth).expect(200);
    expect(ids(res)).toEqual([4, 6, 3, 2]);
  });

  test('the device route uses the same rule', async () => {
    const res = await api().get(`/api/v1/devices/${MAC}/alerts`).query({ from: FROM, to: TO }).set(user.auth).expect(200);
    expect(ids(res)).toEqual([4, 6, 3, 2]);
  });

  test('no range still lists everything, and ?to= alone still filters by start', async () => {
    const all = await api().get('/api/v1/alerts').set(user.auth).expect(200);
    expect(ids(all)).toEqual([5, 4, 6, 3, 2, 1]);
    const until = await api().get('/api/v1/alerts').query({ to: '2026-11-06T00:00:00Z' }).set(user.auth).expect(200);
    expect(ids(until)).toEqual([2, 1]);
  });
});

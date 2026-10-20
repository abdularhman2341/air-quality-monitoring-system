require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const DEMO_DEVICES = [
  { id: 'A4CF123B9E01', pairingCode: '482913', state: 'online', basePpm: 120, alarmAt: null },
  { id: 'A4CF123B9E7F', pairingCode: '735104', state: 'offline', basePpm: 60, alarmAt: 3 },
];

const READINGS_PER_DEVICE = 30;
const INTERVAL_MS = 60 * 1000;

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const device of DEMO_DEVICES) {
      const hash = await bcrypt.hash(device.pairingCode, 10);
      const inserted = await client.query(
        `INSERT INTO devices (device_id, pairing_code_hash, connection_state, online_since)
         VALUES ($1, $2, $3::varchar, CASE WHEN $3::varchar = 'online' THEN now() END)
         ON CONFLICT (device_id) DO NOTHING
         RETURNING device_id`,
        [device.id, hash, device.state],
      );
      if (inserted.rowCount === 0) {
        console.log(`${device.id} already exists, skipped`);
        continue;
      }

      const end = device.state === 'online' ? Date.now() : Date.now() - 45 * 60 * 1000;
      for (let i = READINGS_PER_DEVICE - 1; i >= 0; i -= 1) {
        const ts = new Date(end - i * INTERVAL_MS);
        const ppm = device.basePpm + Math.round(Math.sin(i / 3) * 15);
        const alarm = device.alarmAt !== null && i === device.alarmAt;
        await client.query(
          `INSERT INTO readings (device_id, seq, lpg_ppm_est, alarm_active, reading_time)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [device.id, READINGS_PER_DEVICE - i, alarm ? 1250 : ppm, alarm, ts],
        );
      }
      await client.query(
        `UPDATE devices SET last_reading_at = (SELECT max(reading_time) FROM readings WHERE device_id = $1)
         WHERE device_id = $1`,
        [device.id],
      );
      console.log(`${device.id} created with ${READINGS_PER_DEVICE} readings (pairing code ${device.pairingCode})`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
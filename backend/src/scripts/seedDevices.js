require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const prisma = require('../db/prisma');

const DEMO_DEVICES = [
  { id: 'A4CF123B9E01', pairingCode: '482913', state: 'online', basePpm: 120, alarmAt: null },
  { id: 'A4CF123B9E7F', pairingCode: '735104', state: 'offline', basePpm: 60, alarmAt: 3 },
];

const READINGS_PER_DEVICE = 30;
const INTERVAL_MS = 60 * 1000;

function buildReadings(device) {
  const end = device.state === 'online' ? Date.now() : Date.now() - 45 * 60 * 1000;
  const readings = [];
  for (let i = READINGS_PER_DEVICE - 1; i >= 0; i -= 1) {
    const ppm = device.basePpm + Math.round(Math.sin(i / 3) * 15);
    const alarm = device.alarmAt !== null && i === device.alarmAt;
    readings.push({
      device_id: device.id,
      seq: READINGS_PER_DEVICE - i,
      lpg_ppm_est: alarm ? 1250 : ppm,
      alarm_active: alarm,
      reading_time: new Date(end - i * INTERVAL_MS),
    });
  }
  return readings;
}

async function seed() {
  const hashes = await Promise.all(DEMO_DEVICES.map((device) => bcrypt.hash(device.pairingCode, 10)));

  await prisma.$transaction(async (tx) => {
    for (const [index, device] of DEMO_DEVICES.entries()) {
      const { count } = await tx.device.createMany({
        data: [{
          device_id: device.id,
          pairing_code_hash: hashes[index],
          connection_state: device.state,
          online_since: device.state === 'online' ? new Date() : null,
        }],
        skipDuplicates: true,
      });
      if (count === 0) {
        console.log(`${device.id} already exists, skipped`);
        continue;
      }

      const readings = buildReadings(device);
      await tx.reading.createMany({ data: readings, skipDuplicates: true });
      await tx.device.update({
        where: { device_id: device.id },
        data: { last_reading_at: readings[readings.length - 1].reading_time },
      });
      console.log(`${device.id} created with ${READINGS_PER_DEVICE} readings (pairing code ${device.pairingCode})`);
    }
  });
}

seed()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
// seed.js
// Development data for Sprint 1: one test user and one test device.
// Sign-in is built in Sprint 2, so the password hash is a placeholder.
//
// Run: npx prisma db seed
// Set TEST_DEVICE_MAC in .env to the MAC printed by your ESP32.
// Never run on the production database.

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TEST_EMAIL = 'test@gasmonitor.local';
const TEST_DEVICE_MAC = (process.env.TEST_DEVICE_MAC || 'A4CF123B9E01')
  .replace(/[:-]/g, '')
  .toUpperCase();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed the production database.');
  }

  // upsert = create if missing, otherwise leave as is. Safe to run twice.
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: {
      name: 'Test User',
      email: TEST_EMAIL,
      password_hash: 'placeholder-not-a-real-hash',
    },
  });

  await prisma.device.upsert({
    where: { device_id: TEST_DEVICE_MAC },
    update: { owner_id: user.id },
    create: {
      device_id: TEST_DEVICE_MAC,
      owner_id: user.id,
      pairing_code_hash: 'placeholder-not-a-real-hash',
      name: 'Kitchen Sensor',
      location: 'Test kitchen',
    },
  });

  console.log(`Seeded user ${TEST_EMAIL} with device ${TEST_DEVICE_MAC}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

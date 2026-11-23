require('dotenv').config({ quiet: true });
const User = require('../models/User');
const { requireEmail } = require('../utils/validate');

// Makes an existing account an admin. Used once for the first admin; after
// that, admins promote others from the admin page.
// Usage: npm run make-admin -- <email>
async function makeAdmin(rawEmail) {
  const email = requireEmail(rawEmail);
  const user = await User.findByEmail(email);
  if (!user) {
    throw new Error(`No account uses this email: ${email}`);
  }
  if (user.isAdmin()) {
    return 'already_admin';
  }
  await user.promote();
  return 'promoted';
}

if (require.main === module) {
  const prisma = require('../db/prisma');
  makeAdmin(process.argv[2])
    .then((result) => {
      console.log(result === 'promoted' ? `${process.argv[2]} is now an admin.` : `${process.argv[2]} is already an admin.`);
    })
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { makeAdmin };

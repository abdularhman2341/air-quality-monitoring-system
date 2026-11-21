require('dotenv').config({ quiet: true });
const mailService = require('../services/MailService');

// Sends one email with the current mail settings, to check them.
// Usage: npm run send-test-email -- <email>
async function sendTestEmail(to) {
  return mailService.send({
    to,
    subject: 'AQMS test email',
    text: 'This is a test email from the AQMS backend. If you can read it, sending works.',
  });
}

if (require.main === module) {
  sendTestEmail(process.argv[2])
    .then((result) => {
      console.log(`Sent with the "${mailService.driver}" driver. Id: ${result.id}`);
    })
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    });
}

module.exports = { sendTestEmail };

const HttpError = require('../errors/HttpError');
const User = require('../models/User');

// Runs after requireAuth. Read from the database on every request, so the
// route opens as soon as the email is verified, with the same token.
async function requireVerifiedEmail(req, res, next) {
  const user = await User.findById(req.userId);
  if (!user) {
    throw new HttpError(401, 'USER_NOT_FOUND', 'This account no longer exists.');
  }
  if (!user.isEmailVerified()) {
    throw new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before linking a device.');
  }
  next();
}

module.exports = requireVerifiedEmail;

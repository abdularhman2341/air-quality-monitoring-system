const HttpError = require('../errors/HttpError');
const User = require('../models/User');

// Runs after requireAuth. The role is read from the database on every request
// (not from the token), so a demoted admin loses access at once.
async function requireAdmin(req, res, next) {
  const user = await User.findById(req.userId);
  if (!user || !user.isAdmin()) {
    throw new HttpError(403, 'ADMIN_ONLY', 'Only admins can do this.');
  }
  req.admin = user;
  next();
}

module.exports = requireAdmin;

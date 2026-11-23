const User = require('../models/User');
const VerificationCode = require('../models/VerificationCode');
const RateLimit = require('../models/RateLimit');
const limits = require('../config/rateLimit');
const prisma = require('../db/prisma');
const authService = require('./AuthService');
const { invalidCode, tooManyAttempts } = require('../errors/authErrors');

// Creating an account in two steps: start() saves it inactive and emails a
// 6-digit code; confirm() checks the code, activates the account and signs
// in. An inactive account cannot sign in, so every session belongs to an
// email that its owner proved.
// Every step is counted per address (when known), because each sign-up sends
// an email and the mail quota is shared with the gas alert emails.

// Saves one hit for the address, or throws 429 when it has too many.
async function countAddress(scope, ip, limit) {
  if (!ip) {
    return undefined;
  }
  const hit = await RateLimit.take(scope, ip, limit, limits.windowMinutes);
  if (hit === null) {
    throw tooManyAttempts();
  }
  return hit;
}

class SignupService {
  // A failed email does not fail the sign-up: the user asks for a new code.
  async start(name, email, password, ip = null) {
    await countAddress('signup_address', ip, limits.signupsPerAddress);
    const user = await User.register(name, email, password);
    await authService.sendActivationCode(user);
    return user;
  }

  // One answer for every failure (no account, already active, no code,
  // expired, too many tries, wrong code). A wrong try is saved.
  async confirm(email, code, ip = null) {
    const addressHit = await countAddress('signup_try_address', ip, limits.signupTriesPerAddress);
    const user = await User.findByEmail(email);
    if (!user || user.isEmailVerified() || !(await this.activate(user, code))) {
      throw invalidCode();
    }
    await RateLimit.release(addressHit);
    await RateLimit.clear('login_email', user.email);
    const token = await authService.generateToken(user.id);
    return { token, user };
  }

  async activate(user, code) {
    return prisma.$transaction(async (tx) => {
      if (!(await VerificationCode.consume(tx, user.id, 'verify_email', code))) {
        return false;
      }
      await user.markEmailVerified(tx);
      return true;
    });
  }

  // The same answer whether or not the email has an inactive account.
  async resend(email, ip = null) {
    await countAddress('signup_resend_address', ip, limits.signupResendsPerAddress);
    const user = await User.findByEmail(email);
    if (user && !user.isEmailVerified()) {
      await authService.sendActivationCode(user);
    }
  }
}

module.exports = new SignupService();

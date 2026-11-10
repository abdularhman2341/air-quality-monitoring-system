const jwt = require('jsonwebtoken');
const HttpError = require('../errors/HttpError');
const User = require('../models/User');
const Session = require('../models/Session');
const VerificationCode = require('../models/VerificationCode');
const prisma = require('../db/prisma');
const mailService = require('./MailService');
const {
  passwordResetEmail, passwordChangedEmail, emailVerificationEmail, emailChangeEmail, emailChangedEmail,
} = require('../utils/emails');
const { jwtSecret, tokenExpiry, sessionIdleMinutes } = require('../config/auth');

function unauthorized(code, message) {
  return new HttpError(401, code, message);
}

function invalidCode() {
  return new HttpError(400, 'INVALID_CODE', 'The code is wrong or has expired. Ask for a new one.');
}

function codeRecentlySent() {
  return new HttpError(429, 'CODE_RECENTLY_SENT', 'A code was sent less than a minute ago. Wait a moment before asking again.');
}

class AuthService {
  // The account works at once. The code sent here only unlocks linking a
  // device, so a failed email must not fail the sign-up: the user can ask
  // for a new code from the banner.
  async register(name, email, password) {
    const user = await User.register(name, email, password);
    const code = await VerificationCode.issue(user.id, 'verify_email');
    this.sendInBackground(user.email, emailVerificationEmail(code, VerificationCode.CODE_MINUTES), 'email verification code');
    return user;
  }

  async login(email, password) {
    const user = await User.findByEmail(email);
    const valid = user ? await user.checkPassword(password) : false;
    if (!valid) {
      throw unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    const token = await this.generateToken(user.id);
    return { token, user };
  }

  async generateToken(userId) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + Math.floor(this.expiryMs() / 1000);
    const session = await Session.start(userId, new Date(expiresAt * 1000));
    return jwt.sign({ sid: session.id, iat: issuedAt, exp: expiresAt }, jwtSecret, {
      subject: String(userId),
    });
  }

  async verifyToken(token) {
    let payload;
    try {
      payload = jwt.verify(token, jwtSecret);
    } catch (err) {
      throw unauthorized('INVALID_TOKEN', 'Your session is invalid or has expired. Please sign in again.');
    }
    const usedSince = new Date(Date.now() - sessionIdleMinutes * 60 * 1000);
    const session = await Session.findActive(payload.sid, payload.sub, usedSince);
    if (!session) {
      throw unauthorized('SESSION_ENDED', 'This session has ended. Please sign in again.');
    }
    await Session.touch(session.id);
    return { userId: payload.sub, sessionId: session.id, expiresAt: payload.exp * 1000 };
  }

  async logout(sessionId) {
    await Session.revoke(sessionId);
  }

  // Ends every session of the user, including this one (a copied token shares
  // its session id), then starts a new session for this device.
  async logoutAll(userId, password) {
    await this.confirmPassword(userId, password);
    await Session.revokeAll(userId);
    return this.generateToken(userId);
  }

  async getUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw unauthorized('USER_NOT_FOUND', 'This account no longer exists.');
    }
    return user;
  }
  
  async updateProfile(userId, data) {
    const user = await this.getUser(userId);
    return user.updateProfile(data);
  }

  // Changing the email or deleting the account asks for the current password,
  // so someone with an open session on a shared device cannot take over or
  // delete the account. 403, not 401: the session is still valid, and the
  // frontend signs the user out on any 401.
  async confirmPassword(userId, password) {
    const user = await this.getUser(userId);
    if (!(await user.checkPassword(password))) {
      throw new HttpError(403, 'WRONG_PASSWORD', 'Current password is incorrect.');
    }
    return user;
  }

  async verifyEmail(userId, code) {
    const user = await this.getUser(userId);
    if (user.isEmailVerified()) {
      return user;
    }
    const done = await prisma.$transaction(async (tx) => {
      if (!(await VerificationCode.consume(tx, user.id, 'verify_email', code))) {
        return false;
      }
      await user.markEmailVerified(tx);
      return true;
    });
    if (!done) {
      throw invalidCode();
    }
    return user;
  }

  async resendVerification(userId) {
    const user = await this.getUser(userId);
    if (user.isEmailVerified()) {
      throw new HttpError(409, 'EMAIL_ALREADY_VERIFIED', 'This email is already verified.');
    }
    const code = await VerificationCode.issue(user.id, 'verify_email');
    if (!code) {
      throw codeRecentlySent();
    }
    await this.sendCodeNow(user, 'verify_email', user.email, emailVerificationEmail(code, VerificationCode.CODE_MINUTES), 'email verification code');
  }

  // The email does not change here. The new address is kept as pending_email
  // and gets a code; confirmEmailChange() makes it the email. Without that
  // step, anyone who knows the password could move the account to an address
  // they do not own, or one typed wrong.
  // The code and the pending address are saved together, and a second address
  // within a minute is refused: a code must never confirm an address other
  // than the one it was sent to.
  async changeEmail(userId, email, currentPassword) {
    const user = await this.confirmPassword(userId, currentPassword);
    if (email === user.email) {
      return user.setPendingEmail(null);
    }
    if (await User.findByEmail(email)) {
      throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
    }
    const code = await prisma.$transaction(async (tx) => {
      const issued = await VerificationCode.issue(user.id, 'change_email', { db: tx });
      if (!issued) {
        throw codeRecentlySent();
      }
      await user.setPendingEmail(email, tx);
      return issued;
    });
    try {
      await this.sendCodeNow(user, 'change_email', email, emailChangeEmail(code, VerificationCode.CODE_MINUTES), 'email change code');
    } catch (err) {
      await user.setPendingEmail(null);
      throw err;
    }
    return user;
  }

  async confirmEmailChange(userId, code) {
    const user = await this.getUser(userId);
    const oldEmail = user.email;
    const done = user.pending_email
      ? await prisma.$transaction(async (tx) => {
        if (!(await VerificationCode.consume(tx, user.id, 'change_email', code))) {
          return false;
        }
        await user.applyPendingEmail(tx);
        return true;
      })
      : false;
    if (!done) {
      throw invalidCode();
    }
    this.sendInBackground(oldEmail, emailChangedEmail(user.email), 'email changed notice');
    return user;
  }

  async resendEmailChange(userId) {
    const user = await this.getUser(userId);
    if (!user.pending_email) {
      throw new HttpError(409, 'NO_PENDING_EMAIL', 'No email change is waiting for a code.');
    }
    const code = await VerificationCode.issue(user.id, 'change_email');
    if (!code) {
      throw codeRecentlySent();
    }
    await this.sendCodeNow(user, 'change_email', user.pending_email, emailChangeEmail(code, VerificationCode.CODE_MINUTES), 'email change code');
  }

  // The code row stays, so asking for another address still waits a minute.
  // The code itself is useless: confirm needs a pending address, and the next
  // request replaces the code.
  async cancelEmailChange(userId) {
    const user = await this.getUser(userId);
    return user.setPendingEmail(null);
  }

  async deleteAccount(userId, currentPassword) {
    const user = await this.confirmPassword(userId, currentPassword);
    await user.delete();
  }

  // Emails are sent after the response, so a slow mail provider does not slow
  // the request down, and the response time does not show whether the email
  // belongs to an account. A failure is logged with a fixed label, never the
  // subject or the text: the subject of a reset email contains the code.
  sendInBackground(to, email, label) {
    mailService.sendInBackground(to, email, label);
  }

  // For a code the user is waiting for on the screen: they are told when the
  // email could not be sent. The unsent code is deleted, so they can try
  // again at once instead of waiting a minute for nothing. Same log rule.
  async sendCodeNow(user, purpose, to, email, label) {
    try {
      await mailService.send({ to, ...email });
    } catch (err) {
      console.error(`Mail not sent (${label}): ${err.message}`);
      await VerificationCode.discard(user.id, [purpose]);
      throw new HttpError(502, 'MAIL_NOT_SENT', 'The email could not be sent. Try again shortly.');
    }
  }

  // Always finishes the same way, whether or not the email has an account,
  // so the answer cannot be used to find out who is registered.
  async requestPasswordReset(email) {
    const user = await User.findByEmail(email);
    if (!user) {
      return;
    }
    const code = await VerificationCode.issue(user.id, 'reset_password');
    if (code) {
      this.sendInBackground(user.email, passwordResetEmail(code, VerificationCode.CODE_MINUTES), 'password reset code');
    }
  }

  // One answer for every failure (no account, no code, expired, too many
  // tries, wrong code). A wrong try is saved even though nothing else changes.
  async resetPassword(email, code, newPassword) {
    const user = await User.findByEmail(email);
    const done = user
      ? await prisma.$transaction(async (tx) => {
        if (!(await VerificationCode.consume(tx, user.id, 'reset_password', code))) {
          return false;
        }
        await user.setPassword(newPassword, tx);
        await Session.revokeAll(user.id, tx);
        // The code arrived at this email, so the email is proven too.
        if (!user.isEmailVerified()) {
          await user.markEmailVerified(tx);
        }
        return true;
      })
      : false;
    if (!done) {
      throw invalidCode();
    }
    this.sendInBackground(user.email, passwordChangedEmail(), 'password changed notice');
    return user;
  }

  // Ends every session (a copied token shares the session id of this device),
  // then starts a new one here, the same way as logoutAll().
  async changePassword(userId, currentPassword, newPassword) {
    const user = await this.confirmPassword(userId, currentPassword);
    await prisma.$transaction(async (tx) => {
      await user.setPassword(newPassword, tx);
      await Session.revokeAll(user.id, tx);
      await tx.verificationCode.deleteMany({ where: { user_id: user.id, purpose: 'reset_password' } });
    });
    this.sendInBackground(user.email, passwordChangedEmail(), 'password changed notice');
    return this.generateToken(user.id);
  }

  expiryMs() {
    const match = /^(\d+)([smhd])$/.exec(tokenExpiry);
    if (!match) {
      return 24 * 60 * 60 * 1000;
    }
    const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
    return Number(match[1]) * unit;
  }
}

module.exports = new AuthService();
const jwt = require('jsonwebtoken');
const HttpError = require('../errors/HttpError');
const User = require('../models/User');
const Session = require('../models/Session');
const VerificationCode = require('../models/VerificationCode');
const prisma = require('../db/prisma');
const mailService = require('./MailService');
const { passwordResetEmail, passwordChangedEmail } = require('../utils/emails');
const { jwtSecret, tokenExpiry, sessionIdleMinutes } = require('../config/auth');

function unauthorized(code, message) {
  return new HttpError(401, code, message);
}

class AuthService {
  async register(name, email, password) {
    return User.register(name, email, password);
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

  async changeEmail(userId, email, currentPassword) {
    const user = await this.confirmPassword(userId, currentPassword);
    if (email === user.email) {
      return user;
    }
    return user.changeEmail(email);
  }

  async deleteAccount(userId, currentPassword) {
    const user = await this.confirmPassword(userId, currentPassword);
    await user.delete();
  }

  // Emails are sent after the response, so a slow mail provider does not slow
  // the request down, and the response time does not show whether the email
  // belongs to an account. A failure is logged without the message itself.
  sendInBackground(to, email) {
    mailService.send({ to, ...email }).catch((err) => {
      console.error(`Mail not sent (${email.subject}): ${err.message}`);
    });
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
      this.sendInBackground(user.email, passwordResetEmail(code, VerificationCode.CODE_MINUTES));
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
        return true;
      })
      : false;
    if (!done) {
      throw new HttpError(400, 'INVALID_CODE', 'The code is wrong or has expired. Ask for a new one.');
    }
    this.sendInBackground(user.email, passwordChangedEmail());
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
    this.sendInBackground(user.email, passwordChangedEmail());
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
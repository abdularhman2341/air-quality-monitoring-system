const jwt = require('jsonwebtoken');
const HttpError = require('../errors/HttpError');
const User = require('../models/User');
const Session = require('../models/Session');
const { jwtSecret, tokenExpiry } = require('../config/auth');

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
    const session = await Session.findActive(payload.sid, payload.sub);
    if (!session) {
      throw unauthorized('SESSION_ENDED', 'This session has ended. Please sign in again.');
    }
    return { userId: payload.sub, sessionId: session.id, expiresAt: payload.exp * 1000 };
  }

  async logout(sessionId) {
    await Session.revoke(sessionId);
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
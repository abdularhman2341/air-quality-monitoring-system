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
    const expiresAt = new Date(Date.now() + this.expiryMs());
    const session = await Session.start(userId, expiresAt);
    return jwt.sign({ sid: session.id }, jwtSecret, {
      subject: String(userId),
      expiresIn: Math.floor((expiresAt - Date.now()) / 1000),
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
    return { userId: payload.sub, sessionId: session.id };
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
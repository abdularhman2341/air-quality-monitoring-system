const BaseModel = require('./BaseModel');
const prisma = require('../db/prisma');

// last_used_at is written at most once a minute, not on every request.
const TOUCH_INTERVAL_MS = 60 * 1000;

// One row per sign-in. The JWT carries the session id, so a token stops
// working as soon as its row is revoked, even before the token expires.
class Session extends BaseModel {
  static async start(userId, expiresAt) {
    const row = await prisma.session.create({
      data: { user_id: Number(userId), expires_at: expiresAt },
    });
    return new Session(row);
  }

  // A session counts only if it is not revoked, not expired, and was used
  // after usedSince (the idle limit, sessionIdleMinutes in AuthService).
  static async findActive(id, userId, usedSince) {
    const row = await prisma.session.findFirst({
      where: {
        id,
        user_id: Number(userId),
        revoked_at: null,
        expires_at: { gt: new Date() },
        last_used_at: { gt: usedSince },
      },
    });
    return row ? new Session(row) : null;
  }

  static async touch(id) {
    await prisma.session.updateMany({
      where: { id, last_used_at: { lt: new Date(Date.now() - TOUCH_INTERVAL_MS) } },
      data: { last_used_at: new Date() },
    });
  }

  static async revoke(id) {
    await prisma.session.updateMany({
      where: { id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  // db lets a caller run this inside its own transaction (tx).
  static async revokeAll(userId, db = prisma) {
    await db.session.updateMany({
      where: { user_id: Number(userId), revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }
}

module.exports = Session;
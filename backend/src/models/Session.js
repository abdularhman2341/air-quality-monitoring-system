const BaseModel = require('./BaseModel');
const prisma = require('../db/prisma');

const TOUCH_INTERVAL_MS = 60 * 1000;

class Session extends BaseModel {
  static async start(userId, expiresAt) {
    const row = await prisma.session.create({
      data: { user_id: Number(userId), expires_at: expiresAt },
    });
    return new Session(row);
  }

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
}

module.exports = Session;
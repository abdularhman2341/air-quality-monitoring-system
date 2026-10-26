const BaseModel = require('./BaseModel');
const prisma = require('../db/prisma');

class Session extends BaseModel {
  static async start(userId, expiresAt) {
    const row = await prisma.session.create({
      data: { user_id: Number(userId), expires_at: expiresAt },
    });
    return new Session(row);
  }

  static async findActive(id, userId) {
    const row = await prisma.session.findFirst({
      where: {
        id,
        user_id: Number(userId),
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
    });
    return row ? new Session(row) : null;
  }

  static async revoke(id) {
    await prisma.session.updateMany({
      where: { id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }
}

module.exports = Session;
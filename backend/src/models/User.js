const bcrypt = require('bcryptjs');
const BaseModel = require('./BaseModel');
const HttpError = require('../errors/HttpError');
const prisma = require('../db/prisma');
const Device = require('./Device');
const AdminAction = require('./AdminAction');
const { bcryptRounds } = require('../config/auth');

const UNIQUE_VIOLATION = 'P2002';

class User extends BaseModel {
  static async register(name, email, password) {
    const passwordHash = await bcrypt.hash(password, bcryptRounds);
    try {
      const row = await prisma.user.create({
        data: { name, email, password_hash: passwordHash },
      });
      return new User(row);
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION) {
        throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
      }
      throw err;
    }
  }

  static async findByEmail(email) {
    const row = await prisma.user.findUnique({ where: { email } });
    return row ? new User(row) : null;
  }

  static async findById(id) {
    const row = await prisma.user.findUnique({ where: { id: Number(id) } });
    return row ? new User(row) : null;
  }

  // Admin list: every account, newest last, with how many devices it owns.
  static async search(query, page, limit) {
    const contains = { contains: query, mode: 'insensitive' };
    const where = query ? { OR: [{ name: contains }, { email: contains }] } : {};
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { _count: { select: { devices: true } } },
        orderBy: { id: 'asc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.user.count({ where }),
    ]);
    return { data: rows.map((row) => new User(row)), total };
  }

  async checkPassword(password) {
    return bcrypt.compare(password, this.password_hash);
  }

  async updateProfile({ name }) {
    const row = await prisma.user.update({
      where: { id: this.id },
      data: { name },
    });
    Object.assign(this, row);
    return this;
  }

  async changeEmail(email) {
    try {
      const row = await prisma.user.update({
        where: { id: this.id },
        data: { email },
      });
      Object.assign(this, row);
      return this;
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION) {
        throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
      }
      throw err;
    }
  }

  async setPassword(password, db = prisma) {
    const passwordHash = await bcrypt.hash(password, bcryptRounds);
    const row = await db.user.update({
      where: { id: this.id },
      data: { password_hash: passwordHash },
    });
    Object.assign(this, row);
    return this;
  }

  // Locks every admin row until the transaction ends. Two requests that each
  // remove an admin at the same moment then run one after the other, so they
  // cannot both see "another admin is left" and leave the app with none.
  static async lockAdminIds(tx) {
    const rows = await tx.$queryRaw`SELECT id FROM users WHERE role = 'admin' ORDER BY id FOR UPDATE`;
    return rows.map((row) => row.id);
  }

  static async ensureAnotherAdmin(tx, userId) {
    const adminIds = await User.lockAdminIds(tx);
    if (adminIds.length === 1 && adminIds[0] === Number(userId)) {
      throw new HttpError(409, 'LAST_ADMIN', 'At least one admin must remain. Make another account an admin first.');
    }
  }

  // Used by the make-admin script (admin is null there). Admins change roles
  // from the admin page through adminUpdate().
  async promote(admin = null) {
    await prisma.$transaction(async (tx) => {
      const row = await tx.user.update({ where: { id: this.id }, data: { role: 'admin' } });
      await AdminAction.log(tx, admin, 'user.promote', this.logTarget());
      Object.assign(this, row);
    });
    return this;
  }

  // Admin edit of name, email and role. Only fields that really change are
  // saved, and they are logged with their old values in the same transaction.
  async adminUpdate(changes, admin) {
    const diff = {};
    for (const [field, value] of Object.entries(changes)) {
      if (value !== this[field]) {
        diff[field] = { from: this[field], to: value };
      }
    }
    if (Object.keys(diff).length === 0) {
      return this;
    }
    const data = Object.fromEntries(Object.entries(diff).map(([field, change]) => [field, change.to]));
    const target = this.logTarget();
    try {
      await prisma.$transaction(async (tx) => {
        if (data.role && data.role !== 'admin') {
          await User.ensureAnotherAdmin(tx, this.id);
        }
        const row = await tx.user.update({ where: { id: this.id }, data });
        await AdminAction.log(tx, admin, 'user.update', target, diff);
        Object.assign(this, row);
      });
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION) {
        throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
      }
      throw err;
    }
    return this;
  }

  // Deletes the account in one transaction: its devices are unlinked first
  // (their history is deleted), then the user row. Sessions are deleted by the
  // database (ON DELETE CASCADE), so every token of this account stops working.
  // The last admin cannot be deleted (409 LAST_ADMIN). When an admin deletes
  // the account, the log row is written in the same transaction.
  async delete(admin = null) {
    await prisma.$transaction(async (tx) => {
      await User.ensureAnotherAdmin(tx, this.id);
      if (admin) {
        await AdminAction.log(tx, admin, 'user.delete', this.logTarget(), { name: this.name });
      }
      await Device.releaseAllOwnedBy(tx, this.id);
      await tx.user.delete({ where: { id: this.id } });
    });
  }

  logTarget() {
    return { type: 'user', id: this.id, label: this.email };
  }

  isAdmin() {
    return this.role === 'admin';
  }

  toJSON() {
    const json = { id: String(this.id), name: this.name, email: this.email, role: this.role, created_at: this.created_at };
    if (this._count) {
      json.device_count = this._count.devices;
    }
    return json;
  }
}

module.exports = User;
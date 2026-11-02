const bcrypt = require('bcryptjs');
const BaseModel = require('./BaseModel');
const HttpError = require('../errors/HttpError');
const prisma = require('../db/prisma');
const Device = require('./Device');
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

  // Deletes the account in one transaction: its devices are unlinked first
  // (their history is deleted), then the user row. Sessions are deleted by the
  // database (ON DELETE CASCADE), so every token of this account stops working.
  async delete() {
    await prisma.$transaction(async (tx) => {
      await Device.releaseAllOwnedBy(tx, this.id);
      await tx.user.delete({ where: { id: this.id } });
    });
  }

  toJSON() {
    return { id: String(this.id), name: this.name, email: this.email, created_at: this.created_at };
  }
}

module.exports = User;
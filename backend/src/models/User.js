const bcrypt = require('bcryptjs');
const BaseModel = require('./BaseModel');
const HttpError = require('../errors/HttpError');
const prisma = require('../db/prisma');
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

  toJSON() {
    return { id: String(this.id), name: this.name, email: this.email, created_at: this.created_at };
  }
}

module.exports = User;
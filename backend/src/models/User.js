const bcrypt = require('bcryptjs');
const BaseModel = require('./BaseModel');
const HttpError = require('../errors/HttpError');
const pool = require('../config/db');
const { bcryptRounds } = require('../config/auth');

const UNIQUE_VIOLATION = '23505';

class User extends BaseModel {
  static async register(name, email, password) {
    const passwordHash = await bcrypt.hash(password, bcryptRounds);
    try {
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, password_hash, created_at`,
        [name, email, passwordHash],
      );
      return new User(rows[0]);
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION) {
        throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
      }
      throw err;
    }
  }

  static async findByEmail(email) {
    const { rows } = await pool.query(
      'SELECT id, name, email, password_hash, created_at FROM users WHERE lower(email) = lower($1)',
      [email],
    );
    return rows[0] ? new User(rows[0]) : null;
  }

  static async findById(id) {
    const { rows } = await pool.query(
      'SELECT id, name, email, password_hash, created_at FROM users WHERE id = $1',
      [id],
    );
    return rows[0] ? new User(rows[0]) : null;
  }

  async checkPassword(password) {
    return bcrypt.compare(password, this.password_hash);
  }

  async updateProfile({ name }) {
    const { rows } = await pool.query(
      `UPDATE users SET name = $2
       WHERE id = $1
       RETURNING id, name, email, password_hash, created_at`,
      [this.id, name],
    );
    Object.assign(this, rows[0]);
    return this;
  }

  toJSON() {
    return { id: String(this.id), name: this.name, email: this.email, created_at: this.created_at };
  }
}

module.exports = User;
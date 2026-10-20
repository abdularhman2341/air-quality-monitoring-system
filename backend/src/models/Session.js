const BaseModel = require('./BaseModel');
const pool = require('../config/db');

class Session extends BaseModel {
  static async start(userId, expiresAt) {
    const { rows } = await pool.query(
      `INSERT INTO sessions (user_id, expires_at)
       VALUES ($1, $2)
       RETURNING id, user_id, created_at, expires_at, revoked_at`,
      [userId, expiresAt],
    );
    return new Session(rows[0]);
  }

  static async findActive(id, userId) {
    const { rows } = await pool.query(
      `SELECT id, user_id, created_at, expires_at, revoked_at
       FROM sessions
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()`,
      [id, userId],
    );
    return rows[0] ? new Session(rows[0]) : null;
  }

  static async revoke(id) {
    await pool.query(
      'UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL',
      [id],
    );
  }
}

module.exports = Session;
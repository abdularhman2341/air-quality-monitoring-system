const crypto = require('crypto');
const prisma = require('../db/prisma');
const { codeSecret } = require('../config/auth');

const CODE_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;

// The code is 6 digits, so there are only a million of them: a plain hash
// could be reversed by trying them all. The HMAC key is not in the database,
// so the stored value is useless without the server's secret.
function hashCode(userId, purpose, code) {
  return crypto.createHmac('sha256', codeSecret).update(`${purpose}:${userId}:${code}`).digest('hex');
}

function newCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

class VerificationCode {
  // Saves a new code for this user and purpose and returns it. It replaces
  // any older code. Returns null when a code was sent less than a minute ago
  // (force skips that wait). One statement, so two requests at the same moment
  // cannot both get a code. db is prisma or a transaction.
  static async issue(userId, purpose, { force = false, db = prisma } = {}) {
    const code = newCode();
    const hash = hashCode(userId, purpose, code);
    const rows = await db.$queryRaw`
      INSERT INTO verification_codes (user_id, purpose, code_hash, expires_at)
      VALUES (${Number(userId)}, ${purpose}::code_purpose, ${hash}, now() + make_interval(mins => ${CODE_MINUTES}::int))
      ON CONFLICT (user_id, purpose) DO UPDATE
        SET code_hash = EXCLUDED.code_hash, attempts = 0, created_at = now(), expires_at = EXCLUDED.expires_at
        WHERE ${force}::boolean OR verification_codes.created_at < now() - make_interval(secs => ${RESEND_SECONDS}::int)
      RETURNING id`;
    return rows.length ? code : null;
  }

  // Checks a code inside a transaction. Every try is counted first, in the
  // same statement that locks the row, so tries sent at the same moment are
  // counted one by one and cannot go past the limit. A correct code is
  // deleted, so it works once.
  static async consume(tx, userId, purpose, code) {
    const rows = await tx.$queryRaw`
      UPDATE verification_codes SET attempts = attempts + 1
      WHERE user_id = ${Number(userId)} AND purpose = ${purpose}::code_purpose
        AND expires_at > now() AND attempts < ${MAX_ATTEMPTS}::int
      RETURNING id, code_hash`;
    if (rows.length === 0) {
      return false;
    }
    const expected = Buffer.from(rows[0].code_hash, 'hex');
    const given = Buffer.from(hashCode(userId, purpose, code), 'hex');
    if (!crypto.timingSafeEqual(expected, given)) {
      return false;
    }
    await tx.verificationCode.delete({ where: { id: rows[0].id } });
    return true;
  }

  static async discard(userId, purposes, db = prisma) {
    await db.verificationCode.deleteMany({ where: { user_id: Number(userId), purpose: { in: purposes } } });
  }
}

VerificationCode.CODE_MINUTES = CODE_MINUTES;
VerificationCode.MAX_ATTEMPTS = MAX_ATTEMPTS;
VerificationCode.RESEND_SECONDS = RESEND_SECONDS;

module.exports = VerificationCode;

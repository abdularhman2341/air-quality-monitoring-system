const prisma = require('../db/prisma');

const KEEP_HOURS = 24;

// Counts things per key (an email or an address) in a time window. Each
// counted thing is one row, so the count survives a restart and is shared if
// the server ever runs as more than one copy.
class RateLimit {
  // Saves one hit and returns its id, or null when the key already has
  // `limit` hits in the last `minutes`. The lock makes requests for the same
  // key wait for each other, so hits sent at the same moment cannot all pass.
  static async take(scope, key, limit, minutes) {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${scope}:${key}`}))::text`;
      await tx.$executeRaw`DELETE FROM rate_limit_hits WHERE created_at < now() - make_interval(hours => ${KEEP_HOURS}::int)`;
      return tx.$queryRaw`
        INSERT INTO rate_limit_hits (scope, key)
        SELECT ${scope}, ${key}
        WHERE (
          SELECT count(*) FROM rate_limit_hits
          WHERE scope = ${scope} AND key = ${key} AND created_at > now() - make_interval(mins => ${minutes}::int)
        ) < ${limit}::int
        RETURNING id`;
    });
    return rows.length ? rows[0].id : null;
  }

  // Takes back one hit, for a try that turned out fine.
  static async release(id) {
    if (id !== null && id !== undefined) {
      await prisma.rateLimitHit.deleteMany({ where: { id } });
    }
  }

  static async clear(scope, key) {
    await prisma.rateLimitHit.deleteMany({ where: { scope, key } });
  }
}

module.exports = RateLimit;

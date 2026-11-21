-- An account now works only after its email code. Sessions that accounts
-- never activated still hold are ended, so every open session belongs to an
-- email its owner proved. The owner types the code at the next sign-in.
UPDATE "sessions" SET "revoked_at" = now()
WHERE "revoked_at" IS NULL
  AND "user_id" IN (SELECT "id" FROM "users" WHERE "email_verified_at" IS NULL);

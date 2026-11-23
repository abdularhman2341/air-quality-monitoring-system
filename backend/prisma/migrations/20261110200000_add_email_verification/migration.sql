-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMPTZ(6),
ADD COLUMN     "pending_email" VARCHAR(255);

-- Accounts that existed before email verification are treated as verified
-- from the day they were created, so nobody is locked out of linking devices.
UPDATE "users" SET "email_verified_at" = "created_at";

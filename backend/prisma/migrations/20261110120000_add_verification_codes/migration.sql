-- CreateEnum
CREATE TYPE "code_purpose" AS ENUM ('reset_password', 'verify_email', 'change_email');

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "purpose" "code_purpose" NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_codes_user_id_purpose_key" ON "verification_codes"("user_id", "purpose");

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

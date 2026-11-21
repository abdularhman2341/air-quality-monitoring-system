-- AlterTable
ALTER TABLE "users" ADD COLUMN     "alert_emails" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "alert_email_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "email_sent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "rate_limit_hits" (
    "id" SERIAL NOT NULL,
    "scope" VARCHAR(30) NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_hits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_limit_hits_scope_key_created_at_idx" ON "rate_limit_hits"("scope", "key", "created_at");

-- CreateIndex
CREATE INDEX "rate_limit_hits_created_at_idx" ON "rate_limit_hits"("created_at");

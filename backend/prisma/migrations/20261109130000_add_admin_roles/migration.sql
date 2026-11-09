-- Accounts that exist when this runs become normal users. The first admin is
-- set with: npm run make-admin -- <email>
-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('user', 'admin');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "user_role" NOT NULL DEFAULT 'user';

-- CreateTable
CREATE TABLE "admin_actions" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER,
    "admin_email" VARCHAR(255),
    "action" VARCHAR(50) NOT NULL,
    "target_type" VARCHAR(20) NOT NULL,
    "target_id" VARCHAR(50) NOT NULL,
    "target_label" VARCHAR(255),
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_actions_created_at_idx" ON "admin_actions"("created_at");

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


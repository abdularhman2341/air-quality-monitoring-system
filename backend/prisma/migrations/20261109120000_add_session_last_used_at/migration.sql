-- Sessions open when this runs count as used now, so they get a full idle window.
ALTER TABLE "sessions" ADD COLUMN "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

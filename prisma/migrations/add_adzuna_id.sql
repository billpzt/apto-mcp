-- Safe one-off migration: add the adzunaId column to the Job table.
-- Run with: psql $DATABASE_URL -f prisma/migrations/add_adzuna_id.sql
-- or paste it into your provider's SQL console.
-- Do not use `prisma db push` if the database holds tables outside this
-- schema: it will offer to drop them.

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "adzunaId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Job_adzunaId_key" ON "Job"("adzunaId");

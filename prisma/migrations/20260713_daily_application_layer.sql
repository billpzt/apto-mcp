BEGIN;

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "canonicalUrl" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "titleFamily" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "remoteScope" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "eligibleFromBrazil" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "eligibilityEvidence" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "postedAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "lastVerifiedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Job_canonicalUrl_idx" ON "Job"("canonicalUrl");
CREATE INDEX IF NOT EXISTS "Job_eligibleFromBrazil_status_idx"
  ON "Job"("eligibleFromBrazil", "status");
CREATE INDEX IF NOT EXISTS "Job_appliedAt_idx" ON "Job"("appliedAt");

COMMIT;

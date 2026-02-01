-- AlterTable
ALTER TABLE "TavilyKey"
  ADD COLUMN "creditsCheckedAt" TIMESTAMPTZ NULL,
  ADD COLUMN "creditsExpiresAt" TIMESTAMPTZ NULL,
  ADD COLUMN "creditsKeyUsage" DOUBLE PRECISION NULL,
  ADD COLUMN "creditsKeyLimit" DOUBLE PRECISION NULL,
  ADD COLUMN "creditsKeyRemaining" DOUBLE PRECISION NULL,
  ADD COLUMN "creditsAccountPlanUsage" DOUBLE PRECISION NULL,
  ADD COLUMN "creditsAccountPlanLimit" DOUBLE PRECISION NULL,
  ADD COLUMN "creditsAccountPaygoUsage" DOUBLE PRECISION NULL,
  ADD COLUMN "creditsAccountPaygoLimit" DOUBLE PRECISION NULL,
  ADD COLUMN "creditsAccountRemaining" DOUBLE PRECISION NULL,
  ADD COLUMN "creditsRemaining" DOUBLE PRECISION NULL,
  ADD COLUMN "creditsRefreshLockUntil" TIMESTAMPTZ NULL,
  ADD COLUMN "creditsRefreshLockId" TEXT NULL;

-- CreateIndex
CREATE INDEX "TavilyKey_creditsExpiresAt_creditsRemaining_idx"
  ON "TavilyKey" ("creditsExpiresAt", "creditsRemaining");

-- CreateIndex
CREATE INDEX "TavilyKey_creditsRefreshLockUntil_idx"
  ON "TavilyKey" ("creditsRefreshLockUntil");

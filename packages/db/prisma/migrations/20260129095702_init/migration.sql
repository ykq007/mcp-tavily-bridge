-- CreateEnum
CREATE TYPE "TavilyKeyStatus" AS ENUM ('active', 'disabled', 'cooldown', 'invalid');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('admin', 'viewer');

-- CreateTable
CREATE TABLE "TavilyKey" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keyEncrypted" BYTEA NOT NULL,
    "status" "TavilyKeyStatus" NOT NULL DEFAULT 'active',
    "cooldownUntil" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "failureScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TavilyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientToken" (
    "id" TEXT NOT NULL,
    "description" TEXT,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" BYTEA NOT NULL,
    "scopesJson" JSONB NOT NULL DEFAULT '[]',
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorAdminId" TEXT,
    "eventType" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "outcome" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "detailsJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchJob" (
    "id" TEXT NOT NULL,
    "clientTokenId" TEXT NOT NULL,
    "upstreamKeyId" TEXT NOT NULL,
    "upstreamJobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TavilyKey_label_key" ON "TavilyKey"("label");

-- CreateIndex
CREATE INDEX "TavilyKey_status_cooldownUntil_lastUsedAt_idx" ON "TavilyKey"("status", "cooldownUntil", "lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientToken_tokenPrefix_key" ON "ClientToken"("tokenPrefix");

-- CreateIndex
CREATE INDEX "ClientToken_revokedAt_expiresAt_idx" ON "ClientToken"("revokedAt", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchJob_upstreamJobId_key" ON "ResearchJob"("upstreamJobId");

-- CreateIndex
CREATE INDEX "ResearchJob_clientTokenId_upstreamKeyId_idx" ON "ResearchJob"("clientTokenId", "upstreamKeyId");

-- AddForeignKey
ALTER TABLE "ResearchJob" ADD CONSTRAINT "ResearchJob_clientTokenId_fkey" FOREIGN KEY ("clientTokenId") REFERENCES "ClientToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchJob" ADD CONSTRAINT "ResearchJob_upstreamKeyId_fkey" FOREIGN KEY ("upstreamKeyId") REFERENCES "TavilyKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

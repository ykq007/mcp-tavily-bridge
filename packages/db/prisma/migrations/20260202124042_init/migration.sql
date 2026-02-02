-- CreateTable
CREATE TABLE "TavilyKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "keyEncrypted" BLOB NOT NULL,
    "keyMasked" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "cooldownUntil" DATETIME,
    "lastUsedAt" DATETIME,
    "failureScore" INTEGER NOT NULL DEFAULT 0,
    "creditsCheckedAt" DATETIME,
    "creditsExpiresAt" DATETIME,
    "creditsKeyUsage" REAL,
    "creditsKeyLimit" REAL,
    "creditsKeyRemaining" REAL,
    "creditsAccountPlanUsage" REAL,
    "creditsAccountPlanLimit" REAL,
    "creditsAccountPaygoUsage" REAL,
    "creditsAccountPaygoLimit" REAL,
    "creditsAccountRemaining" REAL,
    "creditsRemaining" REAL,
    "creditsRefreshLockUntil" DATETIME,
    "creditsRefreshLockId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ClientToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" BLOB NOT NULL,
    "scopesJson" JSONB NOT NULL DEFAULT '[]',
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorAdminId" TEXT,
    "eventType" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "outcome" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "detailsJson" JSONB NOT NULL DEFAULT '{}'
);

-- CreateTable
CREATE TABLE "ResearchJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientTokenId" TEXT NOT NULL,
    "upstreamKeyId" TEXT NOT NULL,
    "upstreamJobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchJob_clientTokenId_fkey" FOREIGN KEY ("clientTokenId") REFERENCES "ClientToken" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResearchJob_upstreamKeyId_fkey" FOREIGN KEY ("upstreamKeyId") REFERENCES "TavilyKey" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TavilyToolUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toolName" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "clientTokenId" TEXT NOT NULL,
    "clientTokenPrefix" TEXT,
    "upstreamKeyId" TEXT,
    "queryHash" TEXT,
    "queryPreview" TEXT,
    "argsJson" JSONB NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,
    CONSTRAINT "TavilyToolUsage_clientTokenId_fkey" FOREIGN KEY ("clientTokenId") REFERENCES "ClientToken" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TavilyToolUsage_upstreamKeyId_fkey" FOREIGN KEY ("upstreamKeyId") REFERENCES "TavilyKey" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServerSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TavilyKey_label_key" ON "TavilyKey"("label");

-- CreateIndex
CREATE INDEX "TavilyKey_status_cooldownUntil_lastUsedAt_idx" ON "TavilyKey"("status", "cooldownUntil", "lastUsedAt");

-- CreateIndex
CREATE INDEX "TavilyKey_creditsExpiresAt_creditsRemaining_idx" ON "TavilyKey"("creditsExpiresAt", "creditsRemaining");

-- CreateIndex
CREATE INDEX "TavilyKey_creditsRefreshLockUntil_idx" ON "TavilyKey"("creditsRefreshLockUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ClientToken_tokenPrefix_key" ON "ClientToken"("tokenPrefix");

-- CreateIndex
CREATE INDEX "ClientToken_revokedAt_expiresAt_idx" ON "ClientToken"("revokedAt", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_eventType_idx" ON "AuditLog"("eventType");

-- CreateIndex
CREATE INDEX "AuditLog_outcome_idx" ON "AuditLog"("outcome");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON "AuditLog"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_actorAdminId_idx" ON "AuditLog"("actorAdminId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchJob_upstreamJobId_key" ON "ResearchJob"("upstreamJobId");

-- CreateIndex
CREATE INDEX "ResearchJob_clientTokenId_upstreamKeyId_idx" ON "ResearchJob"("clientTokenId", "upstreamKeyId");

-- CreateIndex
CREATE INDEX "TavilyToolUsage_timestamp_idx" ON "TavilyToolUsage"("timestamp");

-- CreateIndex
CREATE INDEX "TavilyToolUsage_toolName_idx" ON "TavilyToolUsage"("toolName");

-- CreateIndex
CREATE INDEX "TavilyToolUsage_outcome_idx" ON "TavilyToolUsage"("outcome");

-- CreateIndex
CREATE INDEX "TavilyToolUsage_clientTokenId_timestamp_idx" ON "TavilyToolUsage"("clientTokenId", "timestamp");

-- CreateIndex
CREATE INDEX "TavilyToolUsage_queryHash_idx" ON "TavilyToolUsage"("queryHash");

-- CreateIndex
CREATE INDEX "TavilyToolUsage_upstreamKeyId_idx" ON "TavilyToolUsage"("upstreamKeyId");

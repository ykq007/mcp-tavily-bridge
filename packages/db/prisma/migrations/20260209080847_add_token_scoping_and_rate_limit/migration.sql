-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
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
INSERT INTO "new_AuditLog" ("actorAdminId", "detailsJson", "eventType", "id", "ip", "outcome", "resourceId", "resourceType", "timestamp", "userAgent") SELECT "actorAdminId", "detailsJson", "eventType", "id", "ip", "outcome", "resourceId", "resourceType", "timestamp", "userAgent" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");
CREATE INDEX "AuditLog_eventType_idx" ON "AuditLog"("eventType");
CREATE INDEX "AuditLog_outcome_idx" ON "AuditLog"("outcome");
CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON "AuditLog"("resourceType", "resourceId");
CREATE INDEX "AuditLog_actorAdminId_idx" ON "AuditLog"("actorAdminId");
CREATE TABLE "new_BraveToolUsage" (
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
    CONSTRAINT "BraveToolUsage_clientTokenId_fkey" FOREIGN KEY ("clientTokenId") REFERENCES "ClientToken" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BraveToolUsage_upstreamKeyId_fkey" FOREIGN KEY ("upstreamKeyId") REFERENCES "BraveKey" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BraveToolUsage" ("argsJson", "clientTokenId", "clientTokenPrefix", "errorMessage", "id", "latencyMs", "outcome", "queryHash", "queryPreview", "timestamp", "toolName", "upstreamKeyId") SELECT "argsJson", "clientTokenId", "clientTokenPrefix", "errorMessage", "id", "latencyMs", "outcome", "queryHash", "queryPreview", "timestamp", "toolName", "upstreamKeyId" FROM "BraveToolUsage";
DROP TABLE "BraveToolUsage";
ALTER TABLE "new_BraveToolUsage" RENAME TO "BraveToolUsage";
CREATE INDEX "BraveToolUsage_timestamp_idx" ON "BraveToolUsage"("timestamp");
CREATE INDEX "BraveToolUsage_toolName_idx" ON "BraveToolUsage"("toolName");
CREATE INDEX "BraveToolUsage_outcome_idx" ON "BraveToolUsage"("outcome");
CREATE INDEX "BraveToolUsage_clientTokenId_timestamp_idx" ON "BraveToolUsage"("clientTokenId", "timestamp");
CREATE INDEX "BraveToolUsage_queryHash_idx" ON "BraveToolUsage"("queryHash");
CREATE INDEX "BraveToolUsage_upstreamKeyId_idx" ON "BraveToolUsage"("upstreamKeyId");
CREATE TABLE "new_ClientToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" BLOB NOT NULL,
    "scopesJson" JSONB NOT NULL DEFAULT '[]',
    "allowedTools" JSONB,
    "rateLimit" INTEGER,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ClientToken" ("createdAt", "description", "expiresAt", "id", "revokedAt", "scopesJson", "tokenHash", "tokenPrefix") SELECT "createdAt", "description", "expiresAt", "id", "revokedAt", "scopesJson", "tokenHash", "tokenPrefix" FROM "ClientToken";
DROP TABLE "ClientToken";
ALTER TABLE "new_ClientToken" RENAME TO "ClientToken";
CREATE UNIQUE INDEX "ClientToken_tokenPrefix_key" ON "ClientToken"("tokenPrefix");
CREATE INDEX "ClientToken_revokedAt_expiresAt_idx" ON "ClientToken"("revokedAt", "expiresAt");
CREATE TABLE "new_TavilyToolUsage" (
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
INSERT INTO "new_TavilyToolUsage" ("argsJson", "clientTokenId", "clientTokenPrefix", "errorMessage", "id", "latencyMs", "outcome", "queryHash", "queryPreview", "timestamp", "toolName", "upstreamKeyId") SELECT "argsJson", "clientTokenId", "clientTokenPrefix", "errorMessage", "id", "latencyMs", "outcome", "queryHash", "queryPreview", "timestamp", "toolName", "upstreamKeyId" FROM "TavilyToolUsage";
DROP TABLE "TavilyToolUsage";
ALTER TABLE "new_TavilyToolUsage" RENAME TO "TavilyToolUsage";
CREATE INDEX "TavilyToolUsage_timestamp_idx" ON "TavilyToolUsage"("timestamp");
CREATE INDEX "TavilyToolUsage_toolName_idx" ON "TavilyToolUsage"("toolName");
CREATE INDEX "TavilyToolUsage_outcome_idx" ON "TavilyToolUsage"("outcome");
CREATE INDEX "TavilyToolUsage_clientTokenId_timestamp_idx" ON "TavilyToolUsage"("clientTokenId", "timestamp");
CREATE INDEX "TavilyToolUsage_queryHash_idx" ON "TavilyToolUsage"("queryHash");
CREATE INDEX "TavilyToolUsage_upstreamKeyId_idx" ON "TavilyToolUsage"("upstreamKeyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

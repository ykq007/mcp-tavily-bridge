-- CreateTable
CREATE TABLE "TavilyToolUsage" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

    CONSTRAINT "TavilyToolUsage_pkey" PRIMARY KEY ("id")
);

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

-- AddForeignKey
ALTER TABLE "TavilyToolUsage" ADD CONSTRAINT "TavilyToolUsage_clientTokenId_fkey" FOREIGN KEY ("clientTokenId") REFERENCES "ClientToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TavilyToolUsage" ADD CONSTRAINT "TavilyToolUsage_upstreamKeyId_fkey" FOREIGN KEY ("upstreamKeyId") REFERENCES "TavilyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AlterTable: add shareToken to Comparison
ALTER TABLE "Comparison" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "Comparison_shareToken_key" ON "Comparison"("shareToken");

-- AlterTable: add label to ModelResponse
ALTER TABLE "ModelResponse" ADD COLUMN "label" TEXT NOT NULL DEFAULT '';

-- Drop old metric columns (SQLite requires table recreation; done via db push)
-- The columns promptTokens, completionTokens, totalTokens, estimatedCost, latencyMs
-- have been moved to PerformanceMetrics. db push --force-reset applied the full schema.

-- CreateTable: PerformanceMetrics
CREATE TABLE "PerformanceMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedCost" REAL NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "timeToFirstToken" INTEGER NOT NULL,
    "tokensPerSecond" REAL NOT NULL,
    "responseLength" INTEGER NOT NULL,
    "modelResponseId" TEXT NOT NULL,
    CONSTRAINT "PerformanceMetrics_modelResponseId_fkey" FOREIGN KEY ("modelResponseId") REFERENCES "ModelResponse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PerformanceMetrics_modelResponseId_key" ON "PerformanceMetrics"("modelResponseId");

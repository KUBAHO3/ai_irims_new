-- DropIndex
DROP INDEX "AiAnalysis_applicationId_createdAt_idx";

-- AlterTable
ALTER TABLE "AiAnalysis" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'assessor';

-- CreateIndex
CREATE INDEX "AiAnalysis_applicationId_audience_createdAt_idx" ON "AiAnalysis"("applicationId", "audience", "createdAt");

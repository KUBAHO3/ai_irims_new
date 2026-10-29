-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "externalId" TEXT,
    "status" TEXT NOT NULL,
    "stage" "Stage" NOT NULL,
    "verdict" TEXT,
    "summary" TEXT,
    "result" JSONB,
    "error" TEXT,
    "notSent" JSONB NOT NULL DEFAULT '[]',
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiAnalysis_externalId_key" ON "AiAnalysis"("externalId");

-- CreateIndex
CREATE INDEX "AiAnalysis_applicationId_createdAt_idx" ON "AiAnalysis"("applicationId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('applicant', 'assessor');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('HM', 'VM', 'PF', 'CO', 'MD');

-- CreateEnum
CREATE TYPE "AppStatus" AS ENUM ('draft', 'awaiting_payment', 'in_review', 'queried', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('draft', 'payment', 'verification', 'screening', 'assessment', 'approval', 'decision');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('unpaid', 'proof_uploaded', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "Party" AS ENUM ('applicant', 'fda');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerNo" TEXT,
    "accountType" TEXT,
    "tin" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "applicant" TEXT NOT NULL,
    "applicantAddress" TEXT NOT NULL DEFAULT '',
    "type" "ProductType" NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "submissionType" TEXT NOT NULL DEFAULT 'Single product',
    "brand" TEXT NOT NULL DEFAULT '',
    "generic" TEXT NOT NULL DEFAULT '',
    "form" TEXT NOT NULL DEFAULT '',
    "size" TEXT NOT NULL DEFAULT '',
    "intendedUse" TEXT NOT NULL DEFAULT '',
    "intendedUsers" TEXT NOT NULL DEFAULT '',
    "storage" TEXT NOT NULL DEFAULT '',
    "shelfLife" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "warnings" TEXT NOT NULL DEFAULT '',
    "mfrName" TEXT NOT NULL DEFAULT '',
    "mfrCountry" TEXT NOT NULL DEFAULT '',
    "mfrAddress" TEXT NOT NULL DEFAULT '',
    "origin" TEXT NOT NULL DEFAULT '',
    "srA" TEXT NOT NULL DEFAULT 'No',
    "refAuthority" TEXT NOT NULL DEFAULT '',
    "ltr" TEXT NOT NULL DEFAULT '',
    "trademarkDiffers" BOOLEAN NOT NULL DEFAULT false,
    "labelText" TEXT NOT NULL DEFAULT '',
    "labelLanguages" TEXT[] DEFAULT ARRAY['English']::TEXT[],
    "status" "AppStatus" NOT NULL DEFAULT 'draft',
    "stage" "Stage" NOT NULL DEFAULT 'draft',
    "stageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "step" INTEGER NOT NULL DEFAULT 0,
    "queriedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "certNo" TEXT,
    "expiresAt" TIMESTAMP(3),
    "recommendation" TEXT,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "queryId" TEXT,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'unpaid',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proofId" TEXT,
    "momoRef" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Query" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "from" "Party" NOT NULL,
    "stage" "Stage" NOT NULL,
    "text" TEXT NOT NULL,
    "answered" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Query_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoryEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "by" "Party" NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "stage" "Stage" NOT NULL,

    CONSTRAINT "HistoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCheck" (
    "applicationId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "checkedById" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentCheck_pkey" PRIMARY KEY ("applicationId","requirementId")
);

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "HelpdeskTicket" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "ref" TEXT,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpdeskTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_customerNo_key" ON "User"("customerNo");

-- CreateIndex
CREATE UNIQUE INDEX "Application_ref_key" ON "Application"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Application_certNo_key" ON "Application"("certNo");

-- CreateIndex
CREATE INDEX "Application_ownerId_idx" ON "Application"("ownerId");

-- CreateIndex
CREATE INDEX "Application_status_stage_idx" ON "Application"("status", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_storedName_key" ON "StoredFile"("storedName");

-- CreateIndex
CREATE INDEX "StoredFile_applicationId_requirementId_idx" ON "StoredFile"("applicationId", "requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_applicationId_key" ON "Invoice"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_no_key" ON "Invoice"("no");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_proofId_key" ON "Invoice"("proofId");

-- CreateIndex
CREATE INDEX "Query_applicationId_idx" ON "Query"("applicationId");

-- CreateIndex
CREATE INDEX "HistoryEvent_applicationId_at_idx" ON "HistoryEvent"("applicationId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "HelpdeskTicket_no_key" ON "HelpdeskTicket"("no");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "Query"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_proofId_fkey" FOREIGN KEY ("proofId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Query" ADD CONSTRAINT "Query_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryEvent" ADD CONSTRAINT "HistoryEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCheck" ADD CONSTRAINT "DocumentCheck_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

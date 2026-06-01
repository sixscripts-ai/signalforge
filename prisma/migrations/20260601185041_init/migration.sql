-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL,
    "invalidRows" INTEGER NOT NULL,
    "duplicateRows" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "errorMessage" TEXT
);

-- CreateTable
CREATE TABLE "RawRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "rawData" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawRow_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "rawRowId" TEXT,
    "rowIndex" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationError_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ValidationError_rawRowId_fkey" FOREIGN KEY ("rawRowId") REFERENCES "RawRow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NormalizedRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "company" TEXT,
    "category" TEXT,
    "amount" REAL,
    "status" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "sourceRowIndex" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NormalizedRecord_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchemaProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "requiredFields" TEXT NOT NULL,
    "fieldMappings" TEXT NOT NULL,
    "validationRules" TEXT NOT NULL,
    "dedupeStrategy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "RawRow_importJobId_idx" ON "RawRow"("importJobId");

-- CreateIndex
CREATE INDEX "RawRow_status_idx" ON "RawRow"("status");

-- CreateIndex
CREATE INDEX "ValidationError_importJobId_idx" ON "ValidationError"("importJobId");

-- CreateIndex
CREATE INDEX "ValidationError_severity_idx" ON "ValidationError"("severity");

-- CreateIndex
CREATE INDEX "NormalizedRecord_dedupeKey_idx" ON "NormalizedRecord"("dedupeKey");

-- CreateIndex
CREATE INDEX "NormalizedRecord_importJobId_idx" ON "NormalizedRecord"("importJobId");

-- CreateIndex
CREATE INDEX "NormalizedRecord_email_idx" ON "NormalizedRecord"("email");

-- CreateIndex
CREATE INDEX "NormalizedRecord_createdAt_idx" ON "NormalizedRecord"("createdAt");

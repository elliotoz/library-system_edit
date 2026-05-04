ALTER TABLE "books"
  ADD COLUMN "pdfExtractedText" TEXT,
  ADD COLUMN "pdfIndexStatus" "IndexStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN "pdfIndexedAt" TIMESTAMP(3),
  ADD COLUMN "pdfPageCount" INTEGER;

UPDATE "books"
SET "pdfIndexStatus" = 'PENDING'
WHERE "pdfUrl" IS NOT NULL;

CREATE INDEX "books_pdfIndexStatus_idx" ON "books"("pdfIndexStatus");

-- CreateEnum (if not exists)
DO $$ BEGIN
  CREATE TYPE "IndexStatus" AS ENUM ('PENDING', 'PROCESSING', 'INDEXED', 'FAILED', 'NOT_APPLICABLE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "materials" ADD COLUMN "indexStatus" "IndexStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "material_chunks" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "pageNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_chunks_materialId_chunkIndex_key" ON "material_chunks"("materialId", "chunkIndex");

-- CreateIndex
CREATE INDEX "material_chunks_materialId_idx" ON "material_chunks"("materialId");

-- CreateIndex
CREATE INDEX "materials_indexStatus_idx" ON "materials"("indexStatus");

-- CreateIndex for full-text search
CREATE INDEX material_chunks_content_gin
ON material_chunks
USING GIN (to_tsvector('simple', content));

-- AddForeignKey
ALTER TABLE "material_chunks" ADD CONSTRAINT "material_chunks_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ai_conversations" ADD COLUMN "studyBookId" TEXT,
ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'normal';

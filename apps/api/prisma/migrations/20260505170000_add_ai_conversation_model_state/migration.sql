ALTER TABLE "ai_conversations"
  ADD COLUMN "manualModel" TEXT,
  ADD COLUMN "lastResolvedModel" TEXT,
  ADD COLUMN "lastModelSelectionSource" TEXT;

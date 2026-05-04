ALTER TABLE "ai_conversations"
ADD COLUMN "manualModes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "lastAutoModes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "ai_conversations"
SET "manualModes" = CASE
  WHEN trim("mode") = '' OR "mode" = 'normal' THEN ARRAY[]::TEXT[]
  ELSE ARRAY[lower("mode")]::TEXT[]
END;

ALTER TABLE "ai_conversations"
DROP COLUMN "mode";

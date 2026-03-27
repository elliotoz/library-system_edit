-- Step 1: Add book_id as nullable so existing rows are not rejected
ALTER TABLE "reservations" ADD COLUMN "book_id" TEXT;

-- Step 2: Backfill book_id from the related book_copies row
UPDATE "reservations" r
SET "book_id" = bc."book_id"
FROM "book_copies" bc
WHERE r."bookCopyId" = bc."id";

-- Step 3: Enforce NOT NULL now that all rows are populated
ALTER TABLE "reservations" ALTER COLUMN "book_id" SET NOT NULL;

-- Step 4: Supporting index for userId + bookId lookups
CREATE INDEX IF NOT EXISTS "reservations_user_id_book_id_idx"
  ON "reservations" ("userId", "book_id");

-- Step 5: Partial unique index — prevents a user from having more than one
-- active reservation for the same book at the same time.
-- PENDING = reservation submitted, READY_FOR_PICKUP = approved and waiting.
CREATE UNIQUE INDEX IF NOT EXISTS "reservation_user_book_active_unique"
  ON "reservations" ("userId", "book_id")
  WHERE status IN ('PENDING', 'READY_FOR_PICKUP');

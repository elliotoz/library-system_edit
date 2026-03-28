-- Step 1: Add bookId as nullable so existing rows are not rejected
ALTER TABLE "reservations" ADD COLUMN "bookId" TEXT;

-- Step 2: Backfill bookId from the related book_copies row
UPDATE "reservations" r
SET "bookId" = bc."bookId"
FROM "book_copies" bc
WHERE r."bookCopyId" = bc."id";

-- Step 3: Enforce NOT NULL now that all rows are populated
ALTER TABLE "reservations" ALTER COLUMN "bookId" SET NOT NULL;

-- Step 4: Supporting index for userId + bookId lookups
CREATE INDEX IF NOT EXISTS "reservations_userId_bookId_idx"
  ON "reservations" ("userId", "bookId");

-- Step 5: Partial unique index — prevents a user from having more than one
-- active reservation for the same book at the same time.
CREATE UNIQUE INDEX IF NOT EXISTS "reservation_user_book_active_unique"
  ON "reservations" ("userId", "bookId")
  WHERE status IN ('PENDING', 'READY_FOR_PICKUP');

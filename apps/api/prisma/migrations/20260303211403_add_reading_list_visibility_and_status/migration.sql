-- CreateEnum
CREATE TYPE "ReadingListVisibility" AS ENUM ('PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ReadingListStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'READING_LIST_PUBLISHED';
ALTER TYPE "NotificationType" ADD VALUE 'READING_LIST_UPDATED';

-- AlterTable
ALTER TABLE "reading_lists" ADD COLUMN     "status" "ReadingListStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "visibility" "ReadingListVisibility" NOT NULL DEFAULT 'PUBLIC';

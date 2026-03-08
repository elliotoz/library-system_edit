-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "courses" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "department" TEXT;

/*
  Warnings:

  - You are about to drop the column `order` on the `reading_list_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "reading_list_items" DROP COLUMN "order",
ADD COLUMN     "orderIndex" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "reading_lists" ADD COLUMN     "courseCode" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "semester" TEXT;

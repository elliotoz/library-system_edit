-- CreateEnum
CREATE TYPE "FineStatus" AS ENUM ('PENDING', 'PAID', 'WAIVED');

-- DropIndex
DROP INDEX "borrows_dueAt_idx";

-- DropIndex
DROP INDEX "borrows_status_idx";

-- DropIndex
DROP INDEX "borrows_userId_idx";

-- DropIndex
DROP INDEX "notifications_createdAt_idx";

-- DropIndex
DROP INDEX "notifications_read_idx";

-- DropIndex
DROP INDEX "notifications_userId_idx";

-- DropIndex
DROP INDEX "reservations_userId_idx";

-- CreateTable
CREATE TABLE "fine_payments" (
    "id" TEXT NOT NULL,
    "status" "FineStatus" NOT NULL DEFAULT 'PENDING',
    "borrowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fine_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fine_payments_borrowId_key" ON "fine_payments"("borrowId");

-- CreateIndex
CREATE INDEX "fine_payments_userId_status_idx" ON "fine_payments"("userId", "status");

-- CreateIndex
CREATE INDEX "fine_payments_status_idx" ON "fine_payments"("status");

-- CreateIndex
CREATE INDEX "borrows_userId_status_idx" ON "borrows"("userId", "status");

-- CreateIndex
CREATE INDEX "borrows_status_dueAt_idx" ON "borrows"("status", "dueAt");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "reading_lists_status_visibility_idx" ON "reading_lists"("status", "visibility");

-- CreateIndex
CREATE INDEX "reservations_userId_status_idx" ON "reservations"("userId", "status");

-- AddForeignKey
ALTER TABLE "fine_payments" ADD CONSTRAINT "fine_payments_borrowId_fkey" FOREIGN KEY ("borrowId") REFERENCES "borrows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fine_payments" ADD CONSTRAINT "fine_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fine_payments" ADD CONSTRAINT "fine_payments_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

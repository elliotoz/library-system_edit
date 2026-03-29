-- AddValue: APPROVED to ReservationStatus enum
-- IF NOT EXISTS makes this idempotent (safe to re-run)
ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'APPROVED' AFTER 'PENDING';

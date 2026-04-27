-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notificationPrefs" JSONB NOT NULL DEFAULT '{"emailNotifications":true,"dueDateReminders":true,"reservationAlerts":true}';

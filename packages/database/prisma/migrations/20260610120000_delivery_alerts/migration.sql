-- AlterTable
ALTER TABLE "users" ADD COLUMN "email_notifications_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "email_sent_at" TIMESTAMP(3);

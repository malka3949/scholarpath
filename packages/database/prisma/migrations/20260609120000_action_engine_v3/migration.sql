-- AlterEnum
ALTER TYPE "UserActionType" ADD VALUE 'OPPORTUNITY_ACTION';

-- AlterEnum
ALTER TYPE "UserActionStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "user_actions" ADD COLUMN "source_event_id" TEXT,
ADD COLUMN "priority_version" TEXT NOT NULL DEFAULT 'priority-v1',
ADD COLUMN "expired_at" TIMESTAMP(3);

UPDATE "user_actions" SET "priority_version" = 'priority-v1' WHERE "priority_version" IS NULL;

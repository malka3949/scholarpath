-- CreateEnum
CREATE TYPE "UserActionType" AS ENUM ('DEADLINE_ACTION', 'COMPLETION_ACTION', 'OPTIMIZATION_ACTION', 'ENGAGEMENT_ACTION');

-- CreateEnum
CREATE TYPE "UserActionStatus" AS ENUM ('OPEN', 'DONE', 'DISMISSED');

-- CreateEnum
CREATE TYPE "RelatedEntityType" AS ENUM ('APPLICATION', 'SCHOLARSHIP', 'PROFILE', 'RECOMMENDATION');

-- CreateTable
CREATE TABLE "user_actions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "UserActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority_score" INTEGER NOT NULL,
    "status" "UserActionStatus" NOT NULL DEFAULT 'OPEN',
    "related_entity_type" "RelatedEntityType",
    "related_entity_id" TEXT,
    "cta_path" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_actions_user_id_status_priority_score_idx" ON "user_actions"("user_id", "status", "priority_score");

-- CreateIndex
CREATE UNIQUE INDEX "user_actions_user_id_type_related_entity_type_related_ent_key" ON "user_actions"("user_id", "type", "related_entity_type", "related_entity_id");

-- AddForeignKey
ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

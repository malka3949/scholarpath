-- AlterTable
ALTER TABLE "community_comments" ADD COLUMN "parent_id" TEXT;

-- AddForeignKey
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "community_comments_post_id_parent_id_created_at_idx" ON "community_comments"("post_id", "parent_id", "created_at");

-- AlterTable
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "activation_progress" INTEGER;
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "activation_started_at" TIMESTAMP(3);
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "activation_completed_at" TIMESTAMP(3);
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "activation_error" TEXT;
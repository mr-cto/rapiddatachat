-- CreateTable (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'projects') THEN
        CREATE TABLE "projects" (
            "id" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "user_id" TEXT NOT NULL,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateIndex (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_projects_user') THEN
        CREATE INDEX "idx_projects_user" ON "projects"("user_id");
    END IF;
END $$;
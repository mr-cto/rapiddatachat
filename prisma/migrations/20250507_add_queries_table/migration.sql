-- CreateTable (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'queries') THEN
        CREATE TABLE "queries" (
            "id" TEXT NOT NULL,
            "user_id" TEXT NOT NULL,
            "query_text" TEXT NOT NULL,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "status" TEXT NOT NULL,
            "error" TEXT,
            CONSTRAINT "queries_pkey" PRIMARY KEY ("id")
        );
        
        -- Create user index
        CREATE INDEX "idx_queries_user" ON "queries"("user_id");
    ELSE
        -- AlterTable (only if table exists)
        ALTER TABLE "queries"
        ADD COLUMN IF NOT EXISTS "error" TEXT;
    END IF;
END $$;

-- CreateIndex (if not exists)
CREATE INDEX IF NOT EXISTS "idx_queries_created_at" ON "queries"("created_at");
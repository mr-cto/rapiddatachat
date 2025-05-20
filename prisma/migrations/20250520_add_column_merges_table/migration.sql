-- CreateTable (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'column_merges') THEN
    CREATE TABLE "column_merges" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "file_id" TEXT NOT NULL,
        "merge_name" TEXT NOT NULL,
        "column_list" TEXT[] NOT NULL,
        "delimiter" TEXT NOT NULL DEFAULT ' ',
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "column_merges_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

-- Create indexes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_column_merges_user_id') THEN
    CREATE INDEX "idx_column_merges_user_id" ON "column_merges"("user_id");
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_column_merges_file_id') THEN
    CREATE INDEX "idx_column_merges_file_id" ON "column_merges"("file_id");
  END IF;
END $$;

-- Add foreign key if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'column_merges_file_id_fkey'
    AND table_name = 'column_merges'
  ) THEN
    ALTER TABLE "column_merges" ADD CONSTRAINT "column_merges_file_id_fkey"
    FOREIGN KEY ("file_id") REFERENCES "files"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
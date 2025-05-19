-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "file_data" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,

    CONSTRAINT "file_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_file_data_file') THEN
        CREATE INDEX "idx_file_data_file" ON "file_data"("file_id");
    END IF;
END $$;

-- AddForeignKey (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'file_data_file_id_fkey') THEN
        ALTER TABLE "file_data" ADD CONSTRAINT "file_data_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "files" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingested_at" TIMESTAMP(3),
    "size_bytes" INTEGER NOT NULL,
    "format" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source_id" TEXT,
    "metadata" JSONB,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "sources" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "file_id" TEXT,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

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

            CONSTRAINT "queries_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "results" (
    "id" TEXT NOT NULL,
    "query_id" TEXT NOT NULL,
    "result_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "file_errors" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "error_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "dead_letter_queue" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_retry_at" TIMESTAMP(3),

    CONSTRAINT "dead_letter_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "file_data" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "source_id" TEXT,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,

    CONSTRAINT "file_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "_FileToSources" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FileToSources_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'files_source_id_key') THEN
        CREATE UNIQUE INDEX "files_source_id_key" ON "files"("source_id");
    END IF;
END $$;

-- CreateIndex (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_files_user') THEN
        CREATE INDEX "idx_files_user" ON "files"("user_id");
    END IF;
END $$;

-- CreateIndex (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'sources_file_id_key') THEN
        CREATE UNIQUE INDEX "sources_file_id_key" ON "sources"("file_id");
    END IF;
END $$;

-- CreateIndex (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_queries_user') THEN
        CREATE INDEX "idx_queries_user" ON "queries"("user_id");
    END IF;
END $$;

-- CreateIndex (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_file_data_file') THEN
        CREATE INDEX "idx_file_data_file" ON "file_data"("file_id");
    END IF;
END $$;

-- CreateIndex (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = '_FileToSources_B_index') THEN
        CREATE INDEX "_FileToSources_B_index" ON "_FileToSources"("B");
    END IF;
END $$;

-- AddForeignKey (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'files_source_id_fkey') THEN
        ALTER TABLE "files" ADD CONSTRAINT "files_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'results_query_id_fkey') THEN
        ALTER TABLE "results" ADD CONSTRAINT "results_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'file_errors_file_id_fkey') THEN
        ALTER TABLE "file_errors" ADD CONSTRAINT "file_errors_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dead_letter_queue_file_id_fkey') THEN
        ALTER TABLE "dead_letter_queue" ADD CONSTRAINT "dead_letter_queue_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_FileToSources_A_fkey') THEN
        ALTER TABLE "_FileToSources" ADD CONSTRAINT "_FileToSources_A_fkey" FOREIGN KEY ("A") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_FileToSources_B_fkey') THEN
        ALTER TABLE "_FileToSources" ADD CONSTRAINT "_FileToSources_B_fkey" FOREIGN KEY ("B") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

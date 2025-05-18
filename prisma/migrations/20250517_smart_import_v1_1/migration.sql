-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'ERROR');

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "blob_url" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "rows_processed" INTEGER NOT NULL DEFAULT 0,
    "total_rows" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "blob_deleted_at" TIMESTAMP(3),

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_schema_meta" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "column_name" TEXT NOT NULL,
    "data_type" TEXT NOT NULL,
    "is_nullable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_schema_meta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_import_jobs_project" ON "import_jobs"("project_id");

-- CreateIndex
CREATE INDEX "idx_import_jobs_user" ON "import_jobs"("user_id");

-- CreateIndex
CREATE INDEX "idx_import_jobs_status" ON "import_jobs"("status");

-- CreateIndex
CREATE INDEX "idx_project_schema_meta_project" ON "project_schema_meta"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_schema_meta_project_id_table_name_column_name_key" ON "project_schema_meta"("project_id", "table_name", "column_name");

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_schema_meta" ADD CONSTRAINT "project_schema_meta_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
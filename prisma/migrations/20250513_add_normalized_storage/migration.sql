-- CreateTable
CREATE TABLE "normalized_records" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "file_id" TEXT NOT NULL,
  "schema_id" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "previous_version_id" TEXT,
  "partition_key" TEXT,
  "metadata" JSONB,

  CONSTRAINT "normalized_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "normalized_record_history" (
  "id" TEXT NOT NULL,
  "record_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "file_id" TEXT NOT NULL,
  "schema_id" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "version" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "operation" TEXT NOT NULL,
  "changed_by" TEXT,
  "change_reason" TEXT,

  CONSTRAINT "normalized_record_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "normalized_record_metadata" (
  "id" TEXT NOT NULL,
  "record_id" TEXT NOT NULL,
  "storage_type" TEXT NOT NULL,
  "storage_location" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,

  CONSTRAINT "normalized_record_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_normalized_records_project_id" ON "normalized_records"("project_id");

-- CreateIndex
CREATE INDEX "idx_normalized_records_file_id" ON "normalized_records"("file_id");

-- CreateIndex
CREATE INDEX "idx_normalized_records_schema_id" ON "normalized_records"("schema_id");

-- CreateIndex
CREATE INDEX "idx_normalized_records_version" ON "normalized_records"("version");

-- CreateIndex
CREATE INDEX "idx_normalized_records_is_active" ON "normalized_records"("is_active");

-- CreateIndex
CREATE INDEX "idx_normalized_records_partition_key" ON "normalized_records"("partition_key");

-- CreateIndex
CREATE INDEX "idx_normalized_record_history_record_id" ON "normalized_record_history"("record_id");

-- CreateIndex
CREATE INDEX "idx_normalized_record_history_project_id" ON "normalized_record_history"("project_id");

-- CreateIndex
CREATE INDEX "idx_normalized_record_history_file_id" ON "normalized_record_history"("file_id");

-- CreateIndex
CREATE INDEX "idx_normalized_record_history_schema_id" ON "normalized_record_history"("schema_id");

-- CreateIndex
CREATE INDEX "idx_normalized_record_history_version" ON "normalized_record_history"("version");

-- CreateIndex
CREATE INDEX "idx_normalized_record_metadata_record_id" ON "normalized_record_metadata"("record_id");

-- CreateIndex
CREATE INDEX "idx_normalized_record_metadata_storage_type" ON "normalized_record_metadata"("storage_type");

-- AddForeignKey
ALTER TABLE "normalized_records" ADD CONSTRAINT "normalized_records_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "normalized_records" ADD CONSTRAINT "normalized_records_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "normalized_records" ADD CONSTRAINT "normalized_records_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "global_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "normalized_record_history" ADD CONSTRAINT "normalized_record_history_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "normalized_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "normalized_record_history" ADD CONSTRAINT "normalized_record_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "normalized_record_history" ADD CONSTRAINT "normalized_record_history_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "normalized_record_history" ADD CONSTRAINT "normalized_record_history_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "global_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "normalized_record_metadata" ADD CONSTRAINT "normalized_record_metadata_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "normalized_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
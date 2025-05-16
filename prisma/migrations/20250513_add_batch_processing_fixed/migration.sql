-- CreateTable
CREATE TABLE "batch_jobs" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "total_records" INTEGER,
  "processed_records" INTEGER,
  "failed_records" INTEGER,
  "configuration" JSONB,
  "project_id" TEXT,
  "file_id" TEXT,

  CONSTRAINT "batch_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_partitions" (
  "id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "partition_number" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "total_records" INTEGER,
  "processed_records" INTEGER,
  "failed_records" INTEGER,
  "partition_data" JSONB,

  CONSTRAINT "batch_partitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_metrics" (
  "id" TEXT NOT NULL,
  "component" TEXT NOT NULL,
  "metric_name" TEXT NOT NULL,
  "metric_value" DOUBLE PRECISION NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "context" JSONB,
  "job_id" TEXT,
  "partition_id" TEXT,

  CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_usage" (
  "id" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_name" TEXT NOT NULL,
  "usage_value" DOUBLE PRECISION NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "context" JSONB,
  "job_id" TEXT,

  CONSTRAINT "resource_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tuning_history" (
  "id" TEXT NOT NULL,
  "parameter_name" TEXT NOT NULL,
  "old_value" TEXT NOT NULL,
  "new_value" TEXT NOT NULL,
  "reason" TEXT,
  "effectiveness" DOUBLE PRECISION,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "job_id" TEXT,

  CONSTRAINT "tuning_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_batch_jobs_status" ON "batch_jobs"("status");

-- CreateIndex
CREATE INDEX "idx_batch_jobs_project_id" ON "batch_jobs"("project_id");

-- CreateIndex
CREATE INDEX "idx_batch_jobs_file_id" ON "batch_jobs"("file_id");

-- CreateIndex
CREATE INDEX "idx_batch_partitions_job_id" ON "batch_partitions"("job_id");

-- CreateIndex
CREATE INDEX "idx_batch_partitions_status" ON "batch_partitions"("status");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_component" ON "performance_metrics"("component");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_metric_name" ON "performance_metrics"("metric_name");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_timestamp" ON "performance_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_job_id" ON "performance_metrics"("job_id");

-- CreateIndex
CREATE INDEX "idx_resource_usage_resource_type" ON "resource_usage"("resource_type");

-- CreateIndex
CREATE INDEX "idx_resource_usage_resource_name" ON "resource_usage"("resource_name");

-- CreateIndex
CREATE INDEX "idx_resource_usage_timestamp" ON "resource_usage"("timestamp");

-- CreateIndex
CREATE INDEX "idx_resource_usage_job_id" ON "resource_usage"("job_id");

-- CreateIndex
CREATE INDEX "idx_tuning_history_parameter_name" ON "tuning_history"("parameter_name");

-- CreateIndex
CREATE INDEX "idx_tuning_history_timestamp" ON "tuning_history"("timestamp");

-- CreateIndex
CREATE INDEX "idx_tuning_history_job_id" ON "tuning_history"("job_id");

-- Check if projects table exists before adding foreign keys
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'projects') THEN
    -- AddForeignKey
    ALTER TABLE "batch_jobs" ADD CONSTRAINT "batch_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
ALTER TABLE "batch_jobs" ADD CONSTRAINT "batch_jobs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_partitions" ADD CONSTRAINT "batch_partitions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "batch_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "batch_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_partition_id_fkey" FOREIGN KEY ("partition_id") REFERENCES "batch_partitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_usage" ADD CONSTRAINT "resource_usage_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "batch_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tuning_history" ADD CONSTRAINT "tuning_history_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "batch_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
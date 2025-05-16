-- CreateTable
CREATE TABLE "error_logs" (
  "id" TEXT NOT NULL,
  "error_type" TEXT NOT NULL,
  "error_message" TEXT NOT NULL,
  "error_context" JSONB,
  "error_stack" TEXT,
  "request_id" TEXT,
  "user_id" TEXT,
  "system_state" JSONB,
  "project_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_health" (
  "id" TEXT NOT NULL,
  "component" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "last_check_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error" TEXT,
  "metrics" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "system_health_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_error_logs_error_type" ON "error_logs"("error_type");

-- CreateIndex
CREATE INDEX "idx_error_logs_created_at" ON "error_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_error_logs_project_id" ON "error_logs"("project_id");

-- CreateIndex
CREATE INDEX "idx_system_health_component" ON "system_health"("component");

-- CreateIndex
CREATE INDEX "idx_system_health_status" ON "system_health"("status");

-- AddForeignKey
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
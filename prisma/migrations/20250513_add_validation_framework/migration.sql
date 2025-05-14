-- CreateTable
CREATE TABLE "validation_rules" (
  "id" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "field" TEXT,
  "type" TEXT NOT NULL,
  "parameters" JSONB,
  "message" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "remediation" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "project_id" TEXT NOT NULL,

  CONSTRAINT "validation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_results" (
  "id" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "record_id" TEXT NOT NULL,
  "rule_id" TEXT NOT NULL,
  "field" TEXT,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "severity" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "validation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_runs" (
  "id" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "file_id" TEXT,
  "total_records" INTEGER NOT NULL,
  "passed_records" INTEGER NOT NULL,
  "failed_records" INTEGER NOT NULL,
  "warning_records" INTEGER NOT NULL,
  "metrics" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "validation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_validation_rules_entity" ON "validation_rules"("entity");

-- CreateIndex
CREATE INDEX "idx_validation_rules_field" ON "validation_rules"("field");

-- CreateIndex
CREATE INDEX "idx_validation_rules_type" ON "validation_rules"("type");

-- CreateIndex
CREATE INDEX "idx_validation_rules_project_id" ON "validation_rules"("project_id");

-- CreateIndex
CREATE INDEX "idx_validation_results_entity" ON "validation_results"("entity");

-- CreateIndex
CREATE INDEX "idx_validation_results_record_id" ON "validation_results"("record_id");

-- CreateIndex
CREATE INDEX "idx_validation_results_rule_id" ON "validation_results"("rule_id");

-- CreateIndex
CREATE INDEX "idx_validation_results_status" ON "validation_results"("status");

-- CreateIndex
CREATE INDEX "idx_validation_runs_entity" ON "validation_runs"("entity");

-- CreateIndex
CREATE INDEX "idx_validation_runs_project_id" ON "validation_runs"("project_id");

-- CreateIndex
CREATE INDEX "idx_validation_runs_file_id" ON "validation_runs"("file_id");

-- AddForeignKey
ALTER TABLE "validation_rules" ADD CONSTRAINT "validation_rules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "validation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
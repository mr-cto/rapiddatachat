-- CreateTable
CREATE TABLE "relationship_definitions" (
  "id" TEXT NOT NULL,
  "source_entity" TEXT NOT NULL,
  "target_entity" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "source_field" TEXT NOT NULL,
  "target_field" TEXT NOT NULL,
  "constraints" JSONB,
  "cascading" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "project_id" TEXT NOT NULL,

  CONSTRAINT "relationship_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_instances" (
  "id" TEXT NOT NULL,
  "definition_id" TEXT NOT NULL,
  "source_record_id" TEXT NOT NULL,
  "target_record_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "relationship_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_validations" (
  "id" TEXT NOT NULL,
  "instance_id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "relationship_validations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_relationship_definitions_source_entity" ON "relationship_definitions"("source_entity");

-- CreateIndex
CREATE INDEX "idx_relationship_definitions_target_entity" ON "relationship_definitions"("target_entity");

-- CreateIndex
CREATE INDEX "idx_relationship_definitions_project_id" ON "relationship_definitions"("project_id");

-- CreateIndex
CREATE INDEX "idx_relationship_instances_definition_id" ON "relationship_instances"("definition_id");

-- CreateIndex
CREATE INDEX "idx_relationship_instances_source_record_id" ON "relationship_instances"("source_record_id");

-- CreateIndex
CREATE INDEX "idx_relationship_instances_target_record_id" ON "relationship_instances"("target_record_id");

-- CreateIndex
CREATE INDEX "idx_relationship_validations_instance_id" ON "relationship_validations"("instance_id");

-- CreateIndex
CREATE INDEX "idx_relationship_validations_status" ON "relationship_validations"("status");

-- AddForeignKey
ALTER TABLE "relationship_definitions" ADD CONSTRAINT "relationship_definitions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_instances" ADD CONSTRAINT "relationship_instances_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "relationship_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_validations" ADD CONSTRAINT "relationship_validations_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "relationship_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
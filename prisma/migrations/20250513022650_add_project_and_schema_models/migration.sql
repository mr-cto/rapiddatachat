-- AlterTable
ALTER TABLE "files" ADD COLUMN     "project_id" TEXT;

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_schemas" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_columns" (
    "id" TEXT NOT NULL,
    "global_schema_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "data_type" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schema_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "column_mappings" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "global_schema_id" TEXT NOT NULL,
    "schema_column_id" TEXT NOT NULL,
    "file_column" TEXT NOT NULL,
    "transformation_rule" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "column_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "column_merges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "merge_name" TEXT NOT NULL,
    "column_list" TEXT[],
    "delimiter" TEXT NOT NULL DEFAULT ' ',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "column_merges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_projects_user" ON "projects"("user_id");

-- CreateIndex
CREATE INDEX "idx_global_schemas_project" ON "global_schemas"("project_id");

-- CreateIndex
CREATE INDEX "idx_schema_columns_global_schema" ON "schema_columns"("global_schema_id");

-- CreateIndex
CREATE UNIQUE INDEX "schema_columns_global_schema_id_name_key" ON "schema_columns"("global_schema_id", "name");

-- CreateIndex
CREATE INDEX "idx_column_mappings_file" ON "column_mappings"("file_id");

-- CreateIndex
CREATE INDEX "idx_column_mappings_global_schema" ON "column_mappings"("global_schema_id");

-- CreateIndex
CREATE INDEX "idx_column_mappings_schema_column" ON "column_mappings"("schema_column_id");

-- CreateIndex
CREATE UNIQUE INDEX "column_mappings_file_id_schema_column_id_key" ON "column_mappings"("file_id", "schema_column_id");

-- CreateIndex
CREATE INDEX "idx_column_merges_user" ON "column_merges"("user_id");

-- CreateIndex
CREATE INDEX "idx_column_merges_file" ON "column_merges"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "column_merges_user_id_file_id_merge_name_key" ON "column_merges"("user_id", "file_id", "merge_name");

-- CreateIndex
CREATE INDEX "idx_files_project" ON "files"("project_id");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_schemas" ADD CONSTRAINT "global_schemas_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schema_columns" ADD CONSTRAINT "schema_columns_global_schema_id_fkey" FOREIGN KEY ("global_schema_id") REFERENCES "global_schemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "column_mappings" ADD CONSTRAINT "column_mappings_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "column_mappings" ADD CONSTRAINT "column_mappings_global_schema_id_fkey" FOREIGN KEY ("global_schema_id") REFERENCES "global_schemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "column_mappings" ADD CONSTRAINT "column_mappings_schema_column_id_fkey" FOREIGN KEY ("schema_column_id") REFERENCES "schema_columns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_data" ADD CONSTRAINT "file_data_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "column_merges" ADD CONSTRAINT "column_merges_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create column_mappings table
CREATE TABLE IF NOT EXISTS "column_mappings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "file_id" UUID NOT NULL,
  "global_schema_id" UUID NOT NULL,
  "schema_column_id" UUID NOT NULL,
  "file_column" TEXT NOT NULL,
  "transformation_rule" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "column_mappings_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "column_mappings_global_schema_id_fkey" FOREIGN KEY ("global_schema_id") REFERENCES "global_schemas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_column_mappings_file_id" ON "column_mappings" ("file_id");
CREATE INDEX IF NOT EXISTS "idx_column_mappings_schema_id" ON "column_mappings" ("global_schema_id");
-- Create the column_mappings table if it doesn't exist
CREATE TABLE IF NOT EXISTS "column_mappings" (
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

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_column_mappings_file_id" ON "column_mappings"("file_id");
CREATE INDEX IF NOT EXISTS "idx_column_mappings_schema_id" ON "column_mappings"("global_schema_id");

-- Add foreign key constraints
ALTER TABLE "column_mappings" 
ADD CONSTRAINT IF NOT EXISTS "column_mappings_file_id_fkey" 
FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "column_mappings" 
ADD CONSTRAINT IF NOT EXISTS "column_mappings_global_schema_id_fkey" 
FOREIGN KEY ("global_schema_id") REFERENCES "global_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
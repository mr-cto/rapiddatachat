-- This migration ensures that all required tables exist before other migrations reference them

-- Create projects table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'projects') THEN
        CREATE TABLE "projects" (
            "id" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "user_id" TEXT NOT NULL,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
        );
        
        CREATE INDEX "idx_projects_user" ON "projects"("user_id");
    END IF;
END $$;

-- Create global_schemas table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'global_schemas') THEN
        CREATE TABLE "global_schemas" (
            "id" TEXT NOT NULL,
            "project_id" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "global_schemas_pkey" PRIMARY KEY ("id")
        );
        
        CREATE INDEX "idx_global_schemas_project" ON "global_schemas"("project_id");
        
        -- Add foreign key if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'global_schemas_project_id_fkey'
        ) THEN
            ALTER TABLE "global_schemas" 
            ADD CONSTRAINT "global_schemas_project_id_fkey" 
            FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;

-- Create schema_columns table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schema_columns') THEN
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
        
        CREATE INDEX "idx_schema_columns_global_schema" ON "schema_columns"("global_schema_id");
        CREATE UNIQUE INDEX "schema_columns_global_schema_id_name_key" ON "schema_columns"("global_schema_id", "name");
        
        -- Add foreign key if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'schema_columns_global_schema_id_fkey'
        ) THEN
            ALTER TABLE "schema_columns" 
            ADD CONSTRAINT "schema_columns_global_schema_id_fkey" 
            FOREIGN KEY ("global_schema_id") REFERENCES "global_schemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;

-- Add project_id column to files table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'files' AND column_name = 'project_id'
    ) THEN
        ALTER TABLE "files" ADD COLUMN "project_id" TEXT;
        
        -- Create index if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_files_project') THEN
            CREATE INDEX "idx_files_project" ON "files"("project_id");
        END IF;
        
        -- Add foreign key if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'files_project_id_fkey'
        ) THEN
            ALTER TABLE "files" 
            ADD CONSTRAINT "files_project_id_fkey" 
            FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;
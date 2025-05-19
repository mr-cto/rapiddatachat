-- Check if view_metadata table exists and create it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'view_metadata'
    ) THEN
        CREATE TABLE "view_metadata" (
            "id" SERIAL PRIMARY KEY,
            "view_name" TEXT NOT NULL UNIQUE,
            "file_id" TEXT NOT NULL,
            "user_id" TEXT NOT NULL,
            "original_filename" TEXT NOT NULL,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Create indexes
        CREATE INDEX "idx_view_metadata_file_id" ON "view_metadata"("file_id");
        CREATE INDEX "idx_view_metadata_user_id" ON "view_metadata"("user_id");
        
        -- Add foreign key constraint if files table exists
        IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'files'
        ) THEN
            ALTER TABLE "view_metadata" 
            ADD CONSTRAINT "view_metadata_file_id_fkey" 
            FOREIGN KEY ("file_id") 
            REFERENCES "files"("id") 
            ON DELETE CASCADE 
            ON UPDATE CASCADE;
        END IF;
        
        RAISE NOTICE 'Created view_metadata table';
    ELSE
        RAISE NOTICE 'view_metadata table already exists';
    END IF;
END $$;
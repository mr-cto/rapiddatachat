-- Check if file_data table exists and create it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'file_data'
    ) THEN
        CREATE TABLE "file_data" (
            "id" TEXT NOT NULL,
            "file_id" TEXT NOT NULL,
            "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "data" JSONB NOT NULL,
            CONSTRAINT "file_data_pkey" PRIMARY KEY ("id")
        );
        
        -- Create index
        CREATE INDEX "idx_file_data_file" ON "file_data"("file_id");
        
        -- Add foreign key constraint
        ALTER TABLE "file_data" 
        ADD CONSTRAINT "file_data_file_id_fkey" 
        FOREIGN KEY ("file_id") 
        REFERENCES "files"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
        
        RAISE NOTICE 'Created file_data table';
    ELSE
        RAISE NOTICE 'file_data table already exists';
    END IF;
END $$;
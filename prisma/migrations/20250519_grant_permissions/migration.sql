-- Migration to grant necessary permissions for Prisma Accelerate

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO "prisma_application";

-- Grant create permission on schema (critical for view creation)
GRANT CREATE ON SCHEMA public TO "prisma_application";

-- Grant permissions on all tables in schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "prisma_application";

-- Grant permissions on all sequences in schema
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "prisma_application";

-- Grant permissions on all functions in schema
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO "prisma_application";

-- Set default permissions for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "prisma_application";

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO "prisma_application";

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT EXECUTE ON FUNCTIONS TO "prisma_application";

-- Note: With Prisma Accelerate, the database user is "prisma_application"
-- This migration addresses the permission issues with view creation
-- that were causing errors during file upload
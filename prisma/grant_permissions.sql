-- First, identify the current user
SELECT current_user AS "Current User";

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO CURRENT_USER;

-- Grant create permission on schema (critical for view creation)
GRANT CREATE ON SCHEMA public TO CURRENT_USER;

-- Grant permissions on all tables in schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO CURRENT_USER;

-- Grant permissions on all sequences in schema
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO CURRENT_USER;

-- Grant permissions on all functions in schema
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO CURRENT_USER;

-- Set default permissions for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO CURRENT_USER;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO CURRENT_USER;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT EXECUTE ON FUNCTIONS TO CURRENT_USER;
# Database Permissions Guide

This document provides instructions for resolving permission issues with database operations, particularly when creating views and tables.

## Understanding the Two Database Connections

The application uses two different database connections for different purposes:

1. **Primary Connection** (`DATABASE_URL`):

   - Used for standard database operations
   - Handles most read/write operations
   - Used for schema modifications (CREATE VIEW, etc.)
   - Configured via the `DATABASE_URL` environment variable

2. **Replica Connection** (`RAW_DATABASE_DATABASE_URL`):
   - Used for heavy operations that might time out with Prisma Accelerate
   - Bypasses Prisma Accelerate for direct database access
   - Used for bulk operations and raw SQL queries
   - Configured via the `RAW_DATABASE_DATABASE_URL` environment variable

The permission issues occur because the replica connection user doesn't have sufficient permissions to create views in the public schema.

## Determining Your Database Users

To determine which database users are being used for each connection:

1. **Check your environment variables**:

   - Look at `DATABASE_URL` and `RAW_DATABASE_DATABASE_URL` in your `.env` file
   - The format is typically: `postgresql://username:password@hostname:port/database_name`
   - Extract the username from each connection string

2. **Check database connections**:
   - Run this SQL query in your PostgreSQL database to see active connections:
   ```sql
   SELECT usename, application_name, client_addr, backend_start
   FROM pg_stat_activity
   WHERE datname = 'your_database_name';
   ```

## Common Permission Issues

The most common permission error you might encounter is:

```
ERROR: permission denied for schema public
```

This occurs when the database user (particularly the replica connection user) doesn't have sufficient permissions to create objects in the public schema.

## Solution Steps

### Grant Database Permissions Using Prisma CLI

We've created a SQL script at `prisma/grant_permissions.sql` that:

1. Identifies the current database user
2. Grants the necessary permissions to that user using `CURRENT_USER`
3. Sets up default privileges for future objects

To apply these permissions, run:

```bash
npm run db:permissions
```

This command uses Prisma's built-in CLI tools to execute the SQL script against your database. The advantage of this approach is:

1. It uses standard Prisma CLI tools rather than custom scripts
2. It automatically uses the correct database user (no hardcoded usernames)
3. It can be easily run in any environment (development, staging, production)
4. It's integrated with your existing Prisma workflow

The permissions granted include:

```sql
-- Grant create permission on schema (critical for view creation)
GRANT CREATE ON SCHEMA public TO CURRENT_USER;

-- Grant permissions on all tables in schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO CURRENT_USER;
```

These permissions are necessary for the file upload process to create views in the public schema.

### Use Primary Client for Schema Operations

We've updated the code to use the primary database client instead of the replica client for CREATE VIEW operations. This ensures that we have the proper permissions for schema modifications.

```javascript
// Use primary client instead of replica client for CREATE VIEW operations
const prisma = getPrismaClient();
return await prisma.$executeRawUnsafe(finalSql, ...(params || []));
```

This change ensures that we have the proper permissions for schema modifications, even if the permissions weren't explicitly granted.

### 3. Set DATABASE_SCHEMA Environment Variable

If you're using a schema other than `public`, make sure to set the `DATABASE_SCHEMA` environment variable in your `.env` file:

```
DATABASE_SCHEMA=your_schema_name
```

### 4. Verify User Persistence

If you're seeing `userExists: false` in the NextAuth logs, verify that user records are being properly persisted in your database. Check the following:

1. Ensure the `users` table exists and has the correct schema
2. Verify that the database user has permissions to insert into the `users` table
3. Check for any errors in the NextAuth logs related to user creation

## Fallback Mechanisms

If permission issues persist, our code now includes multiple fallback mechanisms:

1. First attempt: Regular view creation with schema prefix
2. Second attempt: Materialized view creation if regular view fails
3. Third attempt: Temporary table creation as a last resort
4. Final fallback: Continue with file activation even if all view creation attempts fail

This ensures that files can still be processed and marked as active even if view creation fails due to permission issues.

## Why Two Database Connections?

The application uses two database connections for several reasons:

1. **Performance Optimization**:

   - The primary connection may use Prisma Accelerate, which has limitations for heavy operations
   - The replica connection bypasses these limitations for bulk operations

2. **Connection Pooling**:

   - Having separate connection pools for different types of operations improves performance
   - Prevents long-running operations from blocking other database operations

3. **Error Handling**:

   - If one connection fails, the other can be used as a fallback
   - Provides redundancy for critical database operations

4. **Schema Modifications**:
   - We've updated the code to use the primary connection for schema modifications
   - This ensures proper permissions for operations like CREATE VIEW

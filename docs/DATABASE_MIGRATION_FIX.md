# Database Migration Fix Guide

This document provides instructions for fixing Prisma migration issues related to the database schema.

## Problem Description

There were two main issues with the database migrations:

1. **Duplicate Table Creation**: The `dead_letter_queue` table was defined in both:

   - The initial migration (20250507030812_init)
   - The error handling migration (20250513_add_error_handling)

2. **Dependency Order Issue**: The batch processing migration was trying to reference the `projects` table before it was created:
   - The migration that creates the `projects` table (20250513022650_add_project_and_schema_models)
   - The batch processing migration (20250513_add_batch_processing) that references it

## Solution

We've created fixed versions of the problematic migrations and several scripts to help apply them correctly.

### Fixed Migrations

1. `prisma/migrations/20250513_add_error_handling_fixed/migration.sql` - A version that doesn't try to create the `dead_letter_queue` table again.

2. `prisma/migrations/20250513_add_batch_processing_fixed/migration.sql` - A version that checks if the `projects` table exists before adding foreign key constraints.

### Helper Scripts

We've created several scripts to help fix the migration issues:

1. **Fix Failed Migration Script** (`scripts/fix-failed-migration.js`):

   - Marks the failed migration as rolled back
   - Restores the original migration file temporarily
   - Applies the fixed migrations
   - Generates the Prisma client

2. **Mark Migrations as Applied Script** (`scripts/mark-migrations-applied.js`):

   - Marks all migrations as applied in the database
   - Useful when the schema is already in sync but the migration history is not up to date

3. **Cleanup Migrations Script** (`scripts/cleanup-migrations.js`):

   - Removes backup migration directories
   - Cleans up the migration history

4. **Test Database Connection Script** (`scripts/test-db-connection.js`):
   - Tests the database connection
   - Shows table counts
   - Checks for problematic tables

## How We Fixed the Issue

We followed these steps to fix the migration issues:

1. **Created Fixed Migrations**:

   - Created fixed versions of the problematic migrations that avoid the duplicate table creation and dependency order issues

2. **Fixed Failed Migration**:

   - Ran `node scripts/fix-failed-migration.js` to mark the failed migration as rolled back and apply the fixed migrations
   - This used `prisma db push` to synchronize the database schema without tracking migration history

3. **Marked Migrations as Applied**:

   - Ran `node scripts/mark-migrations-applied.js` to mark all migrations as applied in the database
   - This updated the migration history to match the actual state of the database

4. **Cleaned Up Migration Files**:

   - Ran `node scripts/cleanup-migrations.js` to remove backup migration directories
   - This ensured that the migration status was clean and up to date

5. **Verified the Fix**:
   - Ran `node scripts/test-db-connection.js` to verify that the database connection was working properly
   - Checked that all tables existed and were accessible

## How to Fix Similar Issues

If you encounter similar migration issues in the future, you can follow these steps:

1. **Identify the Problem**:

   - Run `npx prisma migrate status` to see the current migration status
   - Look for failed migrations or inconsistencies between the local migration history and the database

2. **Fix Failed Migrations**:

   - Run `node scripts/fix-failed-migration.js` to mark failed migrations as rolled back and apply fixed migrations

3. **Update Migration History**:

   - Run `node scripts/mark-migrations-applied.js` to mark all migrations as applied in the database

4. **Clean Up Migration Files**:

   - Run `node scripts/cleanup-migrations.js` to remove backup migration directories

5. **Verify the Fix**:
   - Run `node scripts/test-db-connection.js` to verify that the database connection is working properly
   - Run `npx prisma migrate status` to check that the migration status is clean

## Preventing Future Issues

To prevent similar issues in the future:

1. **Use Consistent Migration Naming**: Use a consistent format for migration names, preferably with timestamps (YYYYMMDDHHMMSS).

2. **Check for Existing Tables**: In migrations, use `CREATE TABLE IF NOT EXISTS` or check if tables exist before creating them.

3. **Use Prisma Migrate Dev**: When developing locally, use `npx prisma migrate dev --name your_migration_name` to let Prisma handle migration ordering.

4. **Review Migrations Before Deployment**: Always review migrations before applying them to production to catch potential issues.

5. **Test Migrations in a Staging Environment**: Apply migrations to a staging environment before deploying to production to catch issues early.

## Troubleshooting

If you encounter issues after applying the fix:

1. **Reset the Database**: If possible, consider resetting your database and applying migrations from scratch:

```bash
npx prisma migrate reset
```

2. **Check Migration History**: Verify the migration history in your database:

```bash
npx prisma migrate status
```

3. **Inspect the Database Schema**: Use a database client to inspect the actual schema and compare it with your Prisma schema.

4. **Contact Support**: If you continue to experience issues, contact the development team for assistance.

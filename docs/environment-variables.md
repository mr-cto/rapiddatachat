# Environment Variables for RapidDataChat

This document describes the environment variables used in RapidDataChat, with a focus on those related to the simplified data upload flow with global schema management.

## Core Environment Variables

| Variable         | Description                                  | Default                                                                   |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| DATABASE_URL     | PostgreSQL connection string                 | postgresql://username:password@localhost:5432/rapiddatachat?schema=public |
| NEXTAUTH_URL     | URL for NextAuth authentication              | http://localhost:3000                                                     |
| NEXTAUTH_SECRET  | Secret for NextAuth authentication           | (generate a secure random string)                                         |
| STORAGE_PROVIDER | Storage provider for files ("local" or "s3") | local                                                                     |
| LOG_LEVEL        | Logging level                                | info                                                                      |

## Simplified Data Upload Flow Variables

The following environment variables are specific to the simplified data upload flow with global schema management:

### Project Management

| Variable              | Description                                  | Default    |
| --------------------- | -------------------------------------------- | ---------- |
| PROJECT_STORAGE_PATH  | Path to store project-related data           | ./projects |
| MAX_PROJECTS_PER_USER | Maximum number of projects a user can create | 50         |

### Schema Management

| Variable                | Description                                   | Default |
| ----------------------- | --------------------------------------------- | ------- |
| SCHEMA_VALIDATION_LEVEL | Level of schema validation                    | strict  |
| MAX_SCHEMA_COLUMNS      | Maximum number of columns allowed in a schema | 100     |
| COLUMN_MAPPING_STRATEGY | Strategy for automatic column mapping         | fuzzy   |
| ENABLE_SCHEMA_EVOLUTION | Allow adding new columns to existing schemas  | true    |

### Data Normalization

| Variable                 | Description                                       | Default |
| ------------------------ | ------------------------------------------------- | ------- |
| NORMALIZATION_BATCH_SIZE | Number of records to process in a batch           | 1000    |
| ENABLE_DATA_VALIDATION   | Validate data against schema during normalization | true    |

## Setting Up Environment Variables

You can set up your environment variables in one of the following ways:

1. **Using the setup script**:

   ```bash
   node scripts/setup-env.js
   ```

   This script will guide you through setting up your environment variables based on the .env.example file.

2. **Manual setup**:

   - Copy .env.example to .env
   - Edit the .env file to set your environment variables

3. **Vercel deployment**:
   - Add these variables in the Vercel dashboard under Project Settings > Environment Variables

## Validation Levels

The `SCHEMA_VALIDATION_LEVEL` variable can be set to one of the following values:

- **strict**: All data must conform exactly to the schema. Any data that doesn't match will be rejected.
- **lenient**: Data that doesn't match the schema will be transformed if possible, or set to null if not.

## Column Mapping Strategies

The `COLUMN_MAPPING_STRATEGY` variable can be set to one of the following values:

- **exact**: Only map columns with exact name matches
- **fuzzy**: Map columns with similar names (case-insensitive, ignoring spaces and special characters)
- **none**: Don't perform automatic mapping, require manual mapping for all columns

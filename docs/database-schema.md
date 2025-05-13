# Database Schema for Simplified Data Upload Flow

This document describes the database schema design for the simplified data upload flow with global schema management.

## Entity Relationship Diagram

```
+-------------+       +---------------+       +----------------+
|   Project   |-------|    File       |-------|   FileData     |
+-------------+       +---------------+       +----------------+
      |                     |
      |                     |
      v                     v
+-------------+       +---------------+
| GlobalSchema|-------|ColumnMapping  |
+-------------+       +---------------+
      |                     ^
      |                     |
      v                     |
+-------------+             |
|SchemaColumn |-------------+
+-------------+
```

## Models

### Project

The `Project` model is the top-level entity that organizes related files and schemas.

| Field       | Type     | Description                       |
| ----------- | -------- | --------------------------------- |
| id          | String   | Unique identifier (UUID)          |
| name        | String   | Project name                      |
| description | String?  | Optional project description      |
| userId      | String   | User who owns the project         |
| createdAt   | DateTime | When the project was created      |
| updatedAt   | DateTime | When the project was last updated |

Relations:

- One-to-many with `File`
- One-to-many with `GlobalSchema`

### File

The `File` model represents an uploaded file. It has been extended to include a relation to the `Project` model.

| Field                 | Type      | Description                        |
| --------------------- | --------- | ---------------------------------- |
| id                    | String    | Unique identifier (UUID)           |
| userId                | String    | User who uploaded the file         |
| projectId             | String?   | Project the file belongs to        |
| filename              | String    | Original filename                  |
| uploadedAt            | DateTime  | When the file was uploaded         |
| ingestedAt            | DateTime? | When the file was ingested         |
| sizeBytes             | Int       | File size in bytes                 |
| format                | String?   | File format (CSV, XLSX, etc.)      |
| status                | String    | File status                        |
| filepath              | String?   | Path to the file on disk           |
| metadata              | Json?     | Additional file metadata           |
| activationProgress    | Int?      | Progress percentage (0-100)        |
| activationStartedAt   | DateTime? | When activation started            |
| activationCompletedAt | DateTime? | When activation completed          |
| activationError       | String?   | Error message if activation failed |

Relations:

- Many-to-one with `Project`
- One-to-many with `Source`
- One-to-many with `FileError`
- One-to-many with `DeadLetterQueueItem`
- One-to-many with `ColumnMerge`
- One-to-many with `ColumnMapping`
- One-to-many with `FileData`

### GlobalSchema

The `GlobalSchema` model represents a unified schema for a project, defining the structure of the normalized data.

| Field       | Type     | Description                      |
| ----------- | -------- | -------------------------------- |
| id          | String   | Unique identifier (UUID)         |
| projectId   | String   | Project the schema belongs to    |
| name        | String   | Schema name                      |
| description | String?  | Optional schema description      |
| createdAt   | DateTime | When the schema was created      |
| updatedAt   | DateTime | When the schema was last updated |

Relations:

- Many-to-one with `Project`
- One-to-many with `SchemaColumn`
- One-to-many with `ColumnMapping`

### SchemaColumn

The `SchemaColumn` model represents a column in the global schema.

| Field          | Type     | Description                         |
| -------------- | -------- | ----------------------------------- |
| id             | String   | Unique identifier (UUID)            |
| globalSchemaId | String   | Global schema the column belongs to |
| name           | String   | Column name                         |
| description    | String?  | Optional column description         |
| dataType       | String   | Data type (text, integer, etc.)     |
| isRequired     | Boolean  | Whether the column is required      |
| createdAt      | DateTime | When the column was created         |
| updatedAt      | DateTime | When the column was last updated    |

Relations:

- Many-to-one with `GlobalSchema`
- One-to-many with `ColumnMapping`

### ColumnMapping

The `ColumnMapping` model maps columns from uploaded files to columns in the global schema.

| Field              | Type     | Description                          |
| ------------------ | -------- | ------------------------------------ |
| id                 | String   | Unique identifier (UUID)             |
| fileId             | String   | File the mapping belongs to          |
| globalSchemaId     | String   | Global schema the mapping belongs to |
| schemaColumnId     | String   | Schema column being mapped to        |
| fileColumn         | String   | Column name in the file              |
| transformationRule | String?  | Optional transformation rule         |
| createdAt          | DateTime | When the mapping was created         |
| updatedAt          | DateTime | When the mapping was last updated    |

Relations:

- Many-to-one with `File`
- Many-to-one with `GlobalSchema`
- Many-to-one with `SchemaColumn`

### FileData

The `FileData` model stores the normalized data from uploaded files according to the global schema.

| Field      | Type     | Description                         |
| ---------- | -------- | ----------------------------------- |
| id         | String   | Unique identifier (UUID)            |
| fileId     | String   | File the data belongs to            |
| ingestedAt | DateTime | When the data was ingested          |
| data       | Json     | Normalized data according to schema |

Relations:

- Many-to-one with `File`

### Other Models

The following models are part of the existing schema and are not directly related to the simplified data upload flow:

- `Source`
- `Query`
- `Result`
- `FileError`
- `DeadLetterQueueItem`
- `ColumnMerge`

## Schema Evolution

The schema design supports schema evolution in the following ways:

1. New columns can be added to the `GlobalSchema` by creating new `SchemaColumn` records.
2. When a new file is uploaded, its columns can be mapped to existing schema columns or new schema columns can be created.
3. The `FileData` model stores data as JSON, which allows for flexible schema changes without requiring database migrations.

## Indexing Strategy

The schema includes the following indexes to ensure efficient querying:

- `idx_projects_user`: Index on `userId` in the `Project` model
- `idx_files_user`: Index on `userId` in the `File` model
- `idx_files_project`: Index on `projectId` in the `File` model
- `idx_global_schemas_project`: Index on `projectId` in the `GlobalSchema` model
- `idx_schema_columns_global_schema`: Index on `globalSchemaId` in the `SchemaColumn` model
- `idx_column_mappings_file`: Index on `fileId` in the `ColumnMapping` model
- `idx_column_mappings_global_schema`: Index on `globalSchemaId` in the `ColumnMapping` model
- `idx_column_mappings_schema_column`: Index on `schemaColumnId` in the `ColumnMapping` model
- `idx_file_data_file`: Index on `fileId` in the `FileData` model

## Unique Constraints

The schema includes the following unique constraints to ensure data integrity:

- `schema_columns_global_schema_id_name_key`: Ensures column names are unique within a global schema
- `column_mappings_file_id_schema_column_id_key`: Ensures a file column is mapped to a schema column only once
- `column_merges_user_id_file_id_merge_name_key`: Ensures merge names are unique within a file for a user

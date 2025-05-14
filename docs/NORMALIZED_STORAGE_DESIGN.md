# Normalized Storage Design

This document outlines the design of the normalized storage logic for the data upload flow. The storage logic is responsible for storing normalized data according to the global schema and column mappings.

## Architecture Patterns

The storage logic supports three different architecture patterns:

### 1. Centralized Pattern

In the centralized pattern, all normalized data is stored in a single table with JSON data. This approach provides flexibility and simplicity, making it suitable for projects with evolving schemas or where the schema is not well-defined upfront.

**Table Structure:**

```sql
CREATE TABLE normalized_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  schema_id TEXT NOT NULL,
  data JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  previous_version_id TEXT,
  partition_key TEXT,
  metadata JSONB
)
```

**Advantages:**

- Simple to implement and maintain
- Flexible schema evolution
- Easy to query all data in a single place

**Disadvantages:**

- Less efficient for complex queries
- Limited type safety
- Potential performance issues with large datasets

### 2. Decentralized Pattern

In the decentralized pattern, each schema has its own table with strongly typed columns. This approach provides better performance for complex queries and stronger type safety, making it suitable for projects with well-defined schemas and complex query requirements.

**Table Structure (dynamically created for each schema):**

```sql
CREATE TABLE normalized_data_{schema_id} (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  schema_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  previous_version_id TEXT,
  partition_key TEXT,
  {schema_column_1} {type_1},
  {schema_column_2} {type_2},
  ...
)
```

**Advantages:**

- Better performance for complex queries
- Stronger type safety
- More efficient storage

**Disadvantages:**

- More complex to implement and maintain
- Schema evolution requires table alterations
- Cross-schema queries are more complex

### 3. Polyglot Pattern

In the polyglot pattern, metadata is stored in SQL databases while actual data can reside in various storage systems based on access patterns. This approach provides flexibility in choosing the right storage system for different types of data, making it suitable for projects with diverse data types and access patterns.

**Metadata Table:**

```sql
CREATE TABLE normalized_record_metadata (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  storage_type TEXT NOT NULL,
  storage_location TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
)
```

**Advantages:**

- Flexibility in choosing the right storage system for different data types
- Optimized performance for different access patterns
- Scalability for large datasets

**Disadvantages:**

- Most complex to implement and maintain
- Requires integration with multiple storage systems
- Potential consistency issues across storage systems

## Versioning and Historization

The storage logic includes mechanisms for versioning and historization of data:

### Versioning

Each record has a version number that corresponds to the schema version. When the schema evolves, new records are created with the new version number, while existing records remain unchanged. This approach allows for backward compatibility and smooth schema evolution.

### Historization

The storage logic maintains a history of all changes to the data, including inserts, updates, and deletes. This history is stored in a separate table:

```sql
CREATE TABLE normalized_record_history (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  schema_id TEXT NOT NULL,
  data JSONB NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  operation TEXT NOT NULL,
  changed_by TEXT,
  change_reason TEXT
)
```

This approach allows for point-in-time queries, audit trails, and data recovery.

## Partitioning Strategies

The storage logic supports different partitioning strategies to improve performance and manageability:

### Time-based Partitioning

Data is partitioned based on a timestamp field, such as `created_at` or a business date. This approach is suitable for time-series data or data with a natural temporal dimension.

### Hash-based Partitioning

Data is partitioned based on a hash of a field, such as `id` or `project_id`. This approach provides even distribution of data across partitions, making it suitable for large datasets with no natural partitioning key.

### Range-based Partitioning

Data is partitioned based on a range of values for a field, such as `id` or a numeric field. This approach is suitable for data with a natural ordering that can be divided into ranges.

### List-based Partitioning

Data is partitioned based on a list of values for a field, such as `status` or `category`. This approach is suitable for categorical data with a limited number of distinct values.

## Retention Policies

The storage logic includes retention policies to manage the lifecycle of data:

### Time-based Retention

Data is retained for a specified period, after which it is archived or purged. This approach is suitable for data with a natural expiration date, such as logs or temporary data.

### Version-based Retention

Data is retained for a specified number of versions, after which older versions are archived or purged. This approach is suitable for data with frequent updates where only recent versions are relevant.

### Size-based Retention

Data is retained until a specified size limit is reached, after which older data is archived or purged. This approach is suitable for data with a fixed storage budget.

## Query Capabilities

The storage logic provides rich query capabilities for retrieving normalized data:

### Basic Queries

- Get all records for a project
- Get all records for a file
- Get a specific record by ID

### Advanced Queries

- Get records with specific field values
- Get records as of a specific point in time
- Get records with a specific version
- Get the history of a record

### Performance Optimizations

- Indexes on frequently queried fields
- Partitioning for large datasets
- Caching for frequently accessed data

## Implementation Considerations

### Database Schema

The database schema includes tables for normalized records, history, and metadata. The schema is designed to support all three architecture patterns and includes indexes for performance optimization.

### API Design

The API provides methods for storing and retrieving normalized data, with support for different architecture patterns, versioning, historization, and partitioning strategies.

### Error Handling

The implementation includes comprehensive error handling to ensure data integrity and provide meaningful error messages to clients.

### Performance Considerations

The implementation is optimized for performance, with support for batch processing, efficient queries, and caching.

### Security Considerations

The implementation includes security measures to protect sensitive data and ensure proper access control.

## Conclusion

The normalized storage logic provides a flexible and powerful foundation for storing and retrieving normalized data. It supports different architecture patterns, versioning, historization, and partitioning strategies, making it suitable for a wide range of use cases.

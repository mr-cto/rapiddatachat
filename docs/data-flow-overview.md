# Simplified Data Upload Flow with Global Schema Management

This document provides an overview of the new simplified data upload flow with global schema management in RapidDataChat.

## Overview

The new data upload flow streamlines the process of uploading and managing data files by introducing a project-based approach with global schema management. This eliminates the need for file activation steps and provides a more intuitive user experience.

## Key Concepts

### Projects

Projects serve as containers for related data files and their associated global schema. Each project has:

- A unique identifier
- A name and description
- A global schema
- Associated data files

### Global Schema

The global schema defines a unified structure for all data within a project. It consists of:

- Schema columns with names, data types, and descriptions
- Metadata about the schema (creation date, last modified, etc.)
- Relationships between columns (optional)

### Column Mappings

Column mappings define how columns in uploaded files map to the global schema. They include:

- Source file column name
- Target global schema column name
- Optional transformation rules

## User Flow

### 1. Project Creation

1. User creates a new project
2. User provides project name and description
3. System creates the project and redirects to the project dashboard

### 2. First File Upload (Schema Creation)

1. User uploads a CSV or XLSX file from the project dashboard
2. System parses the file and extracts column information
3. User is presented with the file's columns and can:
   - Select which columns to include in the global schema
   - Provide names and descriptions for the schema columns
   - Adjust automatically detected data types if needed
4. User confirms the schema creation
5. System creates the global schema and stores the data in a normalized structure

### 3. Subsequent File Uploads (Schema Mapping and Evolution)

1. User uploads another CSV or XLSX file to the same project
2. System parses the file and compares columns with the existing global schema
3. System automatically maps matching columns
4. User is presented with:
   - Mapped columns (can be adjusted if needed)
   - New columns not present in the global schema
5. User can:
   - Adjust column mappings
   - Add new columns to the global schema
   - Define transformation rules for data normalization
6. User confirms the mapping
7. System applies the mappings, updates the global schema if needed, and stores the data

### 4. Data Access and Management

1. User can view and query the normalized data through the project dashboard
2. User can manage the global schema (add, modify, or remove columns)
3. User can view and manage column mappings for each file

## Technical Implementation

### Data Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  File       │     │  Schema     │     │  Normalized │
│  Upload     │────▶│  Management │────▶│  Data       │
│  Component  │     │  Service    │     │  Storage    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   ▲                   │
       │                   │                   │
       ▼                   │                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  File       │     │  Column     │     │  Query      │
│  Parsing    │────▶│  Mapping    │     │  Service    │
│  Service    │     │  Service    │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Components and Services

1. **File Upload Component**

   - Handles file selection and upload
   - Shows progress and validation feedback

2. **File Parsing Service**

   - Extracts column information from CSV/XLSX files
   - Detects data types
   - Provides sample data for preview

3. **Schema Management Service**

   - Creates and updates global schema
   - Manages schema columns and metadata
   - Handles schema versioning

4. **Column Mapping Service**

   - Maps file columns to schema columns
   - Applies transformation rules
   - Validates mappings

5. **Data Normalization Service**

   - Stores data according to the global schema
   - Maintains relationships between files and normalized data
   - Handles data type conversions

6. **Query Service**
   - Provides access to normalized data
   - Supports filtering and aggregation
   - Returns data in a consistent format

### Database Schema

The database schema includes the following key tables:

1. **Projects**

   - `id`: Unique identifier
   - `name`: Project name
   - `description`: Project description
   - `userId`: Owner of the project
   - `createdAt`: Creation timestamp
   - `updatedAt`: Last update timestamp

2. **GlobalSchemas**

   - `id`: Unique identifier
   - `projectId`: Associated project
   - `name`: Schema name
   - `description`: Schema description
   - `createdAt`: Creation timestamp
   - `updatedAt`: Last update timestamp

3. **SchemaColumns**

   - `id`: Unique identifier
   - `schemaId`: Associated global schema
   - `name`: Column name
   - `type`: Data type
   - `description`: Column description
   - `isRequired`: Whether the column is required
   - `order`: Display order

4. **Files**

   - `id`: Unique identifier
   - `projectId`: Associated project
   - `filename`: Original filename
   - `uploadedAt`: Upload timestamp
   - `format`: File format (CSV, XLSX)
   - `size`: File size in bytes

5. **ColumnMappings**

   - `id`: Unique identifier
   - `fileId`: Associated file
   - `schemaColumnId`: Associated schema column
   - `fileColumn`: Column name in the file
   - `transformationRule`: Optional transformation rule

6. **NormalizedData**
   - `id`: Unique identifier
   - `projectId`: Associated project
   - `fileId`: Source file
   - `data`: Normalized data (JSON)
   - `createdAt`: Creation timestamp

## Benefits

1. **Simplified User Experience**

   - Fewer steps to upload and access data
   - Intuitive project-based organization
   - Clear feedback throughout the process

2. **Consistent Data Structure**

   - Unified schema across multiple files
   - Normalized data storage
   - Consistent data types and formats

3. **Flexible Schema Evolution**

   - Add new columns as needed
   - Map different file structures to the same schema
   - Apply transformations for data normalization

4. **Improved Performance**
   - No need for file activation
   - Optimized data storage
   - Efficient querying of normalized data

## Migration from Legacy System

The new system will replace the current file activation process. Existing files will be migrated to the new structure by:

1. Creating a default project for each user
2. Generating a global schema based on the user's active files
3. Creating appropriate column mappings
4. Storing the data in the normalized structure

This migration will be transparent to users and will not affect existing functionality.

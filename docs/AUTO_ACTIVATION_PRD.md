# Product Requirements Document: Automatic File Activation & Schema Standardization

## 1. Overview

### 1.1 Problem Statement

Currently, users must manually activate files after upload before they can be used for querying. This creates friction in the user experience, especially when dealing with large numbers of files. Additionally, while schema mapping exists, it's not integrated into the upload flow, making it difficult to create standardized schemas across multiple files.

### 1.2 Goals

- Automatically activate files upon successful upload
- Integrate schema mapping as a required step in the upload flow
- Enable users to upload and standardize 10s to 100s of Excel/CSV files
- Create a unified, queryable dataset from multiple heterogeneous data sources
- Reduce friction in the data preparation workflow

### 1.3 Success Metrics

- Reduction in time from upload to query capability
- Increase in number of files successfully mapped to standard schemas
- Ability to handle batch uploads of 100+ files
- Improved query performance across multiple files

## 2. Current System Analysis

### 2.1 File Upload Process

- Files are uploaded via the UI
- Files are stored with a PENDING status
- Users must manually click "Activate" to make files queryable
- Schema mapping is available but not integrated into the upload flow

### 2.2 File Activation Process

- Activation creates database views for the file data
- Views are named based on user ID and filename
- View metadata is stored in the `view_metadata` table
- File status is updated to ACTIVE

### 2.3 Schema Management

- SchemaManagementService creates global schemas from active files
- SchemaService extracts schema from activated files
- Column mapping exists but is not enforced during upload

## 3. Proposed Changes

### 3.1 Automatic File Activation

- Files will be automatically activated upon successful upload
- The activation process will run asynchronously to prevent UI blocking
- Progress indicators will show activation status
- Error handling will be enhanced to handle activation failures

### 3.2 Integrated Schema Mapping

- Schema mapping will become a required step in the upload flow
- After upload but before activation, users will map file columns to standard schema
- The system will suggest mappings based on column names and data types
- Users can save mapping templates for future uploads

### 3.3 Batch Upload and Processing

- Support for uploading multiple files simultaneously
- Batch schema mapping for files with similar structures
- Progress tracking for large batch operations
- Resumable uploads for large files or poor connections

### 3.4 Unified Schema Management

- Enhanced global schema creation and management
- Ability to define standard schemas before upload
- Version control for schemas
- Schema evolution capabilities to handle changing data structures

## 4. Technical Requirements

### 4.1 File Upload Enhancements

- Modify the upload API to trigger activation automatically
- Implement background processing for activation
- Add progress tracking and status updates
- Enhance error handling and recovery mechanisms

```typescript
// Example API response enhancement
interface UploadResponse {
  files: {
    id: string;
    filename: string;
    status: string;
    activationStatus: {
      inProgress: boolean;
      progress: number;
      estimatedTimeRemaining: number;
    };
    schemaMapping: {
      required: boolean;
      suggestedMappings: Array<{
        fileColumn: string;
        suggestedSchemaColumn: string;
        confidence: number;
      }>;
    };
  }[];
}
```

### 4.2 Schema Mapping System

- Enhance the SchemaColumnMapper component to be part of the upload flow
- Implement schema suggestion algorithms
- Create a schema mapping template system
- Build batch mapping capabilities for multiple files

```typescript
// Example schema mapping template
interface SchemaTemplate {
  id: string;
  name: string;
  description: string;
  mappings: Array<{
    pattern: string; // Regex pattern to match file column names
    schemaColumn: string;
    transformationRule?: string;
  }>;
  defaultTransformations: Record<string, string>;
}
```

### 4.3 Database and View Management

- Optimize view creation for large numbers of files
- Implement view pooling to reduce database overhead
- Add indexing strategies for improved query performance
- Enhance the view_metadata system to track relationships between views

### 4.4 Performance Optimizations

- Implement chunked processing for large files
- Add caching mechanisms for frequently accessed schemas
- Optimize query generation for multi-file queries
- Implement data partitioning strategies for large datasets

## 5. User Experience

### 5.1 Upload Flow

1. User selects multiple files for upload
2. System shows upload progress for all files
3. Upon successful upload, system automatically begins activation
4. User is presented with schema mapping interface while activation proceeds
5. User maps columns to standard schema (or selects a mapping template)
6. System completes activation and confirms files are ready for querying

### 5.2 Schema Mapping Interface

- Enhanced UI for mapping columns from multiple files
- Drag-and-drop interface for mapping
- Suggestions based on column names, data types, and previous mappings
- Preview of mapped data
- Ability to save and load mapping templates

### 5.3 Batch Operations

- Interface for managing multiple file uploads
- Batch schema mapping for similar files
- Progress tracking and status updates
- Error handling and retry capabilities

### 5.4 Notifications and Feedback

- Real-time status updates during upload and activation
- Notifications when files are ready for querying
- Warnings for potential schema conflicts
- Suggestions for optimizing queries across multiple files

## 6. Implementation Plan

### 6.1 Phase 1: Automatic Activation

- Modify the upload API to trigger activation automatically
- Enhance the FileActivation service to handle asynchronous activation
- Update the UI to show activation progress
- Implement error handling and recovery mechanisms

### 6.2 Phase 2: Schema Mapping Integration

- Enhance the SchemaColumnMapper component
- Integrate schema mapping into the upload flow
- Implement schema suggestion algorithms
- Create schema mapping templates

### 6.3 Phase 3: Batch Processing

- Implement batch upload capabilities
- Add batch schema mapping
- Optimize performance for large numbers of files
- Enhance error handling for batch operations

### 6.4 Phase 4: Unified Schema Management

- Enhance global schema creation and management
- Implement schema version control
- Add schema evolution capabilities
- Optimize query performance across multiple files

## 7. Technical Considerations

### 7.1 Database Impact

- Increased number of views may impact database performance
- Need for optimized view creation and management
- Potential for database size growth with many files
- Indexing strategies for improved query performance

### 7.2 Performance Considerations

- Asynchronous processing to prevent UI blocking
- Chunked processing for large files
- Caching mechanisms for frequently accessed schemas
- Query optimization for multi-file queries

### 7.3 Scalability

- Ability to handle 100+ files
- Efficient storage and retrieval of view metadata
- Optimized query generation for large schemas
- Resource management for concurrent uploads and activations

### 7.4 Security

- Maintain user data isolation
- Secure storage of schema mapping templates
- Access control for shared schemas
- Validation of uploaded file contents

## 8. API Changes

### 8.1 Upload API

- Enhanced to return activation status and schema mapping requirements
- Support for batch uploads
- Progress tracking endpoints

### 8.2 Schema Mapping API

- New endpoints for schema template management
- Batch mapping capabilities
- Schema suggestion endpoints

### 8.3 Activation API

- Status tracking endpoints
- Batch activation capabilities
- Enhanced error reporting

## 9. Migration Strategy

### 9.1 Existing Files

- Option to batch activate existing files
- Tool for applying schema mappings to already active files
- Gradual migration to new schema standards

### 9.2 User Education

- In-app tutorials for new workflow
- Documentation for schema mapping best practices
- Examples of effective schema standardization

## 10. Success Criteria

- Users can upload 100+ files and have them automatically activated
- Schema mapping is seamlessly integrated into the upload flow
- Queries can efficiently run across multiple files with standardized schemas
- Time from upload to query capability is reduced by 90%
- System can handle the increased load from automatic activation

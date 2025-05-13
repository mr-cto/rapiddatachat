# Product Requirements Document: Simplified Data Upload Flow with Global Schema Management

## Overview

This document outlines the requirements for a simplified data upload flow that incorporates global schema management. The new flow will streamline the process of uploading and managing data files, allowing users to create a unified schema across multiple uploads while removing the current file activation steps.

## Current System Analysis

The current system has the following components:

- File upload functionality for CSV and XLSX files
- File activation process that creates database views
- Schema management capabilities that are not fully integrated into the upload flow
- Column mapping functionality for mapping file columns to schema columns

## Requirements

### 1. Project Creation and Dashboard

1.1. Users should be able to create a new project.
1.2. Upon project creation, users should be automatically directed to the dashboard for that project.
1.3. The dashboard should provide clear access to the data upload functionality.

### 2. File Upload

2.1. Users should be able to upload CSV or XLSX files from the project dashboard.
2.2. The system should validate file formats and provide appropriate error messages.
2.3. The upload interface should show progress and status information.
2.4. The existing file activation step should be removed from the user flow.

### 3. Global Schema Management

3.1. First Upload (Schema Creation):

- After the first file upload, users should be presented with the file's columns.
- Users should be able to select which columns to include in the global schema.
- Users should be able to provide names and descriptions for the global schema.
- The system should automatically detect column data types.

3.2. Subsequent Uploads (Schema Mapping and Evolution):

- For subsequent uploads, the system should identify new columns not present in the global schema.
- Users should be able to map new file columns to existing schema columns.
- Users should have the option to add new columns to the global schema.
- The mapping interface should support transformation rules for data normalization.

### 4. Data Storage and Normalization

4.1. All uploaded data should be stored in a normalized database structure.
4.2. The system should maintain relationships between the original files and the normalized data.
4.3. The normalized data should be accessible for querying and analysis.

### 5. User Experience

5.1. The entire flow should be intuitive and require minimal steps.
5.2. Clear feedback should be provided at each step of the process.
5.3. Users should be able to view and manage their global schema at any time.
5.4. The interface should provide options to edit or update the schema as needed.

## Technical Requirements

### 1. Backend Changes

1.1. Modify the file ingestion process to bypass the current activation step.
1.2. Enhance the schema management service to support the new flow.
1.3. Implement automatic schema detection and column mapping.
1.4. Create APIs for managing the global schema and column mappings.

### 2. Frontend Changes

2.1. Create a new project creation interface.
2.2. Modify the file upload component to integrate with the new flow.
2.3. Develop a schema management interface for the first upload.
2.4. Develop a column mapping interface for subsequent uploads.
2.5. Update the dashboard to reflect the new workflow.

### 3. Database Changes

3.1. Ensure the database schema supports the normalized data structure.
3.2. Implement efficient storage and retrieval mechanisms.
3.3. Maintain metadata about files, schemas, and mappings.

## Success Criteria

1. Users can create projects and upload files in a streamlined process.
2. The system successfully creates and maintains a global schema across multiple file uploads.
3. New columns from subsequent uploads can be mapped to the global schema.
4. All data is stored in a normalized structure for efficient querying.
5. The entire process requires fewer steps than the current implementation.

## Out of Scope

1. Changes to the query interface or NL-to-SQL functionality.
2. Advanced data transformation beyond basic column mapping.
3. Schema versioning or rollback capabilities.
4. Real-time data processing or streaming.

## Timeline and Priorities

High Priority:

- Project creation and dashboard integration
- File upload without activation
- Initial schema creation from first upload

Medium Priority:

- Column mapping for subsequent uploads
- Schema evolution with new columns

Low Priority:

- Advanced transformation rules
- Schema management interface enhancements

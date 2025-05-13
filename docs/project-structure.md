# Project Structure Documentation

This document outlines the structure of the RapidDataChat application, with a focus on how the new simplified data upload flow with global schema management will be integrated.

## Current Project Structure

The application follows a standard Next.js structure with additional directories for specific functionality:

### Root Directories

- `components/` - React components used throughout the application
- `cypress/` - End-to-end testing with Cypress
- `docs/` - Project documentation
- `hooks/` - React hooks for shared functionality
- `lib/` - Utility functions, services, and business logic
- `prisma/` - Database schema and migrations using Prisma ORM
- `processed/` - Storage for processed data files
- `public/` - Static assets served by Next.js
- `scripts/` - Utility scripts for development and testing
- `src/` - Core application code
  - `src/app/` - Next.js App Router components
  - `src/pages/` - Next.js Pages Router components and API routes
- `styles/` - Global CSS and styling utilities
- `templates/` - Template files for various features
- `types/` - TypeScript type definitions
- `uploads/` - Storage for uploaded files
- `utils/` - Utility functions

### Key Files

- `package.json` - Project dependencies and scripts
- `next.config.ts` - Next.js configuration
- `prisma/schema.prisma` - Database schema definition
- `docker-compose.yml` - Docker configuration for development

## New Data Upload Flow Integration

The new simplified data upload flow with global schema management will be integrated into the existing structure as follows:

### New and Modified Components

- `components/ProjectCreation.tsx` - New component for project creation
- `components/ProjectDashboard.tsx` - New component for project dashboard
- `components/GlobalSchemaCreation.tsx` - New component for creating global schema from first upload
- `components/GlobalSchemaMapping.tsx` - New component for mapping subsequent uploads to global schema
- `components/GlobalSchemaManagement.tsx` - New component for managing global schema

### Backend Services

- `lib/projectService.ts` - New service for project management
- `lib/schemaManagement.ts` - Enhanced service for global schema management
- `lib/fileIngestion.ts` - Modified service for file ingestion without activation
- `lib/dataNormalization.ts` - New service for data normalization and storage

### Database Schema Updates

- New tables in `prisma/schema.prisma`:
  - `Project` - For project management
  - `GlobalSchema` - For global schema definition
  - `SchemaColumn` - For schema column definitions
  - `ColumnMapping` - For mapping file columns to schema columns

### API Routes

- `src/pages/api/projects/` - New API routes for project management
- `src/pages/api/schema-management/` - Enhanced API routes for schema management
- `src/pages/api/upload/` - Modified API route for simplified upload flow

## Implementation Strategy

The implementation will follow these steps:

1. Update database schema with new tables
2. Implement backend services for project and schema management
3. Create frontend components for the new flow
4. Integrate the components into the existing application
5. Remove legacy file activation components
6. Test the complete flow end-to-end

This approach ensures that we build on the existing foundation while introducing the new functionality in a structured manner.

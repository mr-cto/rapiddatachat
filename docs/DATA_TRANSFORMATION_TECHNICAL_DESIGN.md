# Data Transformation Technical Design

## Overview

This document provides the technical design details for implementing the Data Transformation Service as outlined in the Data Transformation Architecture document. It focuses on the concrete implementation aspects, including class structures, interfaces, and database schema.

## Core Components Implementation

### 1. DataTransformationService

The main service that orchestrates the transformation process.

```typescript
// lib/dataTransformation/dataTransformationService.ts

import { MappingEngine } from "./mappingEngine";
import { TransformationRuleEngine } from "./transformationRuleEngine";
import { ValidationFramework } from "./validationFramework";
import { StorageManager } from "./storageManager";
import { ErrorHandler } from "./errorHandler";

export interface TransformationOptions {
  batchSize?: number;
  parallelProcessing?: boolean;
  validationLevel?: "strict" | "lenient" | "none";
  errorHandling?: "fail-fast" | "continue-with-valid" | "skip-invalid";
  logLevel?: "debug" | "info" | "warn" | "error";
}

export interface TransformationResult {
  success: boolean;
  processedRecords: number;
  failedRecords: number;
  validationIssues: ValidationIssue[];
  errors: TransformationError[];
  transformationId: string;
  executionTime: number;
}

export class DataTransformationService {
  private mappingEngine: MappingEngine;
  private transformationRuleEngine: TransformationRuleEngine;
  private validationFramework: ValidationFramework;
  private storageManager: StorageManager;
  private errorHandler: ErrorHandler;

  constructor() {
    this.mappingEngine = new MappingEngine();
    this.transformationRuleEngine = new TransformationRuleEngine();
    this.validationFramework = new ValidationFramework();
    this.storageManager = new StorageManager();
    this.errorHandler = new ErrorHandler();
  }

  /**
   * Transform data from a file according to mappings and transformation rules
   */
  async transformData(
    fileId: string,
    schemaId: string,
    mappings: ColumnMapping[],
    transformationRules: Record<string, TransformationRule[]>,
    options?: TransformationOptions
  ): Promise<TransformationResult> {
    try {
      // Initialize transformation session
      const transformationId = `transform_${Date.now()}`;
      const startTime = Date.now();

      // Get file data
      const fileData = await this.getFileData(fileId);

      // Process data in batches
      const batchSize = options?.batchSize || 1000;
      const batches = this.createBatches(fileData, batchSize);

      let processedRecords = 0;
      let failedRecords = 0;
      const validationIssues: ValidationIssue[] = [];
      const errors: TransformationError[] = [];

      for (const batch of batches) {
        try {
          // Apply mappings
          const mappedBatch = await this.mappingEngine.applyMappings(
            batch,
            mappings,
            schemaId
          );

          // Apply transformation rules
          const transformedBatch =
            await this.transformationRuleEngine.applyTransformations(
              mappedBatch,
              transformationRules
            );

          // Validate data
          const validationLevel = options?.validationLevel || "strict";
          const validationResult = await this.validationFramework.validateData(
            transformedBatch,
            schemaId,
            validationLevel
          );

          // Handle validation issues
          if (validationResult.issues.length > 0) {
            validationIssues.push(...validationResult.issues);

            if (
              options?.errorHandling === "fail-fast" &&
              validationResult.hasErrors
            ) {
              throw new Error("Validation failed with errors");
            }
          }

          // Store valid data
          if (validationResult.validRecords.length > 0) {
            await this.storageManager.storeData(
              validationResult.validRecords,
              schemaId,
              fileId,
              transformationId
            );
          }

          // Update counters
          processedRecords += batch.length;
          failedRecords += validationResult.invalidRecords.length;
        } catch (error) {
          // Handle batch error
          const batchError = this.errorHandler.handleError(error);
          errors.push(batchError);

          if (options?.errorHandling === "fail-fast") {
            throw error;
          }
        }
      }

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Return transformation result
      return {
        success: errors.length === 0,
        processedRecords,
        failedRecords,
        validationIssues,
        errors,
        transformationId,
        executionTime,
      };
    } catch (error) {
      // Handle service-level error
      const serviceError = this.errorHandler.handleError(error);

      return {
        success: false,
        processedRecords: 0,
        failedRecords: 0,
        validationIssues: [],
        errors: [serviceError],
        transformationId: `transform_${Date.now()}`,
        executionTime: 0,
      };
    }
  }

  /**
   * Get file data from storage
   */
  private async getFileData(fileId: string): Promise<any[]> {
    // Implementation to retrieve file data
    // This could be from a database, file system, etc.
    return [];
  }

  /**
   * Create batches from data for processing
   */
  private createBatches(data: any[], batchSize: number): any[][] {
    const batches: any[][] = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    return batches;
  }
}
```

### 2. MappingEngine

Handles the application of column mappings to source data.

```typescript
// lib/dataTransformation/mappingEngine.ts

import { SchemaService } from "../schemaManagement";

export interface ColumnMapping {
  fileColumnName: string;
  schemaColumnId: string;
}

export class MappingEngine {
  private schemaService: SchemaService;

  constructor() {
    this.schemaService = new SchemaService();
  }

  /**
   * Apply mappings to a batch of data
   */
  async applyMappings(
    data: any[],
    mappings: ColumnMapping[],
    schemaId: string
  ): Promise<any[]> {
    // Get schema columns
    const schemaColumns = await this.schemaService.getSchemaColumns(schemaId);

    // Map data according to mappings
    return data.map((row) => {
      const mappedRow: Record<string, any> = {};

      mappings.forEach((mapping) => {
        const schemaColumn = schemaColumns.find(
          (col) => col.id === mapping.schemaColumnId
        );

        if (schemaColumn) {
          mappedRow[schemaColumn.name] = row[mapping.fileColumnName];
        }
      });

      return mappedRow;
    });
  }
}
```

### 3. TransformationRuleEngine

Executes transformation rules on mapped data.

```typescript
// lib/dataTransformation/transformationRuleEngine.ts

export interface TransformationRule {
  id: string;
  name: string;
  description?: string;
  type: string;
  params: Record<string, any>;
}

export class TransformationRuleEngine {
  /**
   * Apply transformation rules to a batch of data
   */
  async applyTransformations(
    data: any[],
    transformationRules: Record<string, TransformationRule[]>
  ): Promise<any[]> {
    return data.map((row) => {
      const transformedRow = { ...row };

      // Apply transformation rules to each column
      Object.entries(transformationRules).forEach(([columnName, rules]) => {
        if (transformedRow[columnName] !== undefined) {
          let value = transformedRow[columnName];

          // Apply each rule in sequence
          for (const rule of rules) {
            value = this.applyTransformation(value, rule);
          }

          transformedRow[columnName] = value;
        }
      });

      return transformedRow;
    });
  }

  /**
   * Apply a single transformation rule to a value
   */
  private applyTransformation(value: any, rule: TransformationRule): any {
    switch (rule.type) {
      case "format":
        return this.applyFormatTransformation(value, rule.params);
      case "replace":
        return this.applyReplaceTransformation(value, rule.params);
      case "truncate":
        return this.applyTruncateTransformation(value, rule.params);
      case "pad":
        return this.applyPadTransformation(value, rule.params);
      case "number":
        return this.applyNumberTransformation(value, rule.params);
      case "date":
        return this.applyDateTransformation(value, rule.params);
      case "custom":
        return this.applyCustomTransformation(value, rule.params);
      default:
        return value;
    }
  }

  // Implementation of specific transformation types
  private applyFormatTransformation(value: any, params: any): any {
    // Implementation
    return value;
  }

  private applyReplaceTransformation(value: any, params: any): any {
    // Implementation
    return value;
  }

  private applyTruncateTransformation(value: any, params: any): any {
    // Implementation
    return value;
  }

  private applyPadTransformation(value: any, params: any): any {
    // Implementation
    return value;
  }

  private applyNumberTransformation(value: any, params: any): any {
    // Implementation
    return value;
  }

  private applyDateTransformation(value: any, params: any): any {
    // Implementation
    return value;
  }

  private applyCustomTransformation(value: any, params: any): any {
    // Implementation
    return value;
  }
}
```

### 4. ValidationFramework

Validates transformed data against schema constraints.

```typescript
// lib/dataTransformation/validationFramework.ts

import { SchemaService } from "../schemaManagement";

export interface ValidationIssue {
  rowIndex: number;
  columnName: string;
  schemaColumnId: string;
  issueType: "missing" | "type" | "format" | "custom";
  message: string;
  severity: "warning" | "error";
}

export interface ValidationResult {
  valid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  issues: ValidationIssue[];
  validRecords: any[];
  invalidRecords: any[];
}

export class ValidationFramework {
  private schemaService: SchemaService;

  constructor() {
    this.schemaService = new SchemaService();
  }

  /**
   * Validate a batch of data against schema constraints
   */
  async validateData(
    data: any[],
    schemaId: string,
    validationLevel: "strict" | "lenient" | "none" = "strict"
  ): Promise<ValidationResult> {
    if (validationLevel === "none") {
      return {
        valid: true,
        hasErrors: false,
        hasWarnings: false,
        issues: [],
        validRecords: data,
        invalidRecords: [],
      };
    }

    // Get schema columns
    const schemaColumns = await this.schemaService.getSchemaColumns(schemaId);

    const issues: ValidationIssue[] = [];
    const validRecords: any[] = [];
    const invalidRecords: any[] = [];

    // Validate each record
    data.forEach((row, rowIndex) => {
      const rowIssues: ValidationIssue[] = [];

      // Check required fields
      schemaColumns.forEach((column) => {
        if (column.isRequired) {
          const value = row[column.name];
          if (value === undefined || value === null || value === "") {
            rowIssues.push({
              rowIndex,
              columnName: column.name,
              schemaColumnId: column.id,
              issueType: "missing",
              message: `Required field "${column.name}" is missing or empty`,
              severity: "error",
            });
          }
        }
      });

      // Check data types
      Object.entries(row).forEach(([columnName, value]) => {
        const schemaColumn = schemaColumns.find(
          (col) => col.name === columnName
        );
        if (schemaColumn && value !== null && value !== undefined) {
          if (!this.validateDataType(value, schemaColumn.type)) {
            rowIssues.push({
              rowIndex,
              columnName,
              schemaColumnId: schemaColumn.id,
              issueType: "type",
              message: `Value "${value}" is not a valid ${schemaColumn.type} for column "${columnName}"`,
              severity: validationLevel === "strict" ? "error" : "warning",
            });
          }
        }
      });

      // Add issues to the overall list
      issues.push(...rowIssues);

      // Determine if the record is valid
      const hasErrors = rowIssues.some((issue) => issue.severity === "error");
      if (hasErrors) {
        invalidRecords.push(row);
      } else {
        validRecords.push(row);
      }
    });

    return {
      valid: issues.length === 0,
      hasErrors: issues.some((issue) => issue.severity === "error"),
      hasWarnings: issues.some((issue) => issue.severity === "warning"),
      issues,
      validRecords,
      invalidRecords,
    };
  }

  /**
   * Validate a value against a data type
   */
  private validateDataType(value: any, type: string): boolean {
    switch (type) {
      case "text":
        return typeof value === "string";
      case "integer":
        return Number.isInteger(Number(value));
      case "float":
        return !isNaN(Number(value));
      case "boolean":
        return (
          typeof value === "boolean" ||
          ["true", "false", "0", "1"].includes(String(value).toLowerCase())
        );
      case "date":
        return !isNaN(Date.parse(String(value)));
      default:
        return true;
    }
  }
}
```

### 5. StorageManager

Handles the storage of normalized data.

```typescript
// lib/dataTransformation/storageManager.ts

import { executeQuery } from "../database";

export class StorageManager {
  /**
   * Store normalized data in the database
   */
  async storeData(
    data: any[],
    schemaId: string,
    fileId: string,
    transformationId: string
  ): Promise<void> {
    if (data.length === 0) {
      return;
    }

    // Get schema information
    const schema = await this.getSchema(schemaId);

    // Create or update normalized data table
    await this.ensureNormalizedDataTable(schema);

    // Store data in batches
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await this.storeBatch(batch, schema, fileId, transformationId);
    }

    // Update metadata
    await this.updateMetadata(schemaId, fileId, transformationId, data.length);
  }

  /**
   * Get schema information
   */
  private async getSchema(schemaId: string): Promise<any> {
    // Implementation
    return {};
  }

  /**
   * Ensure normalized data table exists
   */
  private async ensureNormalizedDataTable(schema: any): Promise<void> {
    // Implementation
  }

  /**
   * Store a batch of data
   */
  private async storeBatch(
    batch: any[],
    schema: any,
    fileId: string,
    transformationId: string
  ): Promise<void> {
    // Implementation
  }

  /**
   * Update metadata after storing data
   */
  private async updateMetadata(
    schemaId: string,
    fileId: string,
    transformationId: string,
    recordCount: number
  ): Promise<void> {
    // Implementation
  }
}
```

### 6. ErrorHandler

Manages error cases and provides recovery mechanisms.

```typescript
// lib/dataTransformation/errorHandler.ts

export interface TransformationError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  recoverable: boolean;
  retryCount?: number;
}

export class ErrorHandler {
  /**
   * Handle an error during transformation
   */
  handleError(error: any): TransformationError {
    const timestamp = Date.now();

    // Determine error type and create appropriate error object
    if (error instanceof Error) {
      return {
        code: "TRANSFORMATION_ERROR",
        message: error.message,
        details: error.stack,
        timestamp,
        recoverable: this.isRecoverableError(error),
      };
    } else {
      return {
        code: "UNKNOWN_ERROR",
        message: String(error),
        timestamp,
        recoverable: false,
      };
    }
  }

  /**
   * Determine if an error is recoverable
   */
  private isRecoverableError(error: Error): boolean {
    // Implementation
    return false;
  }
}
```

## Database Schema

### Normalized Data Tables

For each global schema, we'll create a normalized data table with the following structure:

```sql
CREATE TABLE normalized_data_{schema_id} (
  id TEXT PRIMARY KEY,
  {schema_columns},
  file_id TEXT NOT NULL,
  transformation_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Transformation Metadata Table

```sql
CREATE TABLE transformation_metadata (
  id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  status TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  error_count INTEGER NOT NULL,
  warning_count INTEGER NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  execution_time INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Transformation Issues Table

```sql
CREATE TABLE transformation_issues (
  id TEXT PRIMARY KEY,
  transformation_id TEXT NOT NULL,
  row_index INTEGER,
  column_name TEXT,
  schema_column_id TEXT,
  issue_type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### 1. Initiate Transformation

```typescript
// src/pages/api/data-transformation/transform.ts

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { DataTransformationService } from "../../../lib/dataTransformation/dataTransformationService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Handle POST request
  if (req.method === "POST") {
    try {
      const { fileId, schemaId, mappings, transformationRules, options } =
        req.body;

      // Validate required parameters
      if (!fileId) {
        return res.status(400).json({ error: "File ID is required" });
      }
      if (!schemaId) {
        return res.status(400).json({ error: "Schema ID is required" });
      }
      if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ error: "Mappings are required" });
      }

      // Initialize transformation service
      const transformationService = new DataTransformationService();

      // Start transformation
      const result = await transformationService.transformData(
        fileId,
        schemaId,
        mappings,
        transformationRules || {},
        options
      );

      // Return result
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error in transformation API:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } else {
    // Method not allowed
    return res.status(405).json({ error: "Method not allowed" });
  }
}
```

### 2. Get Transformation Status

```typescript
// src/pages/api/data-transformation/status/[id].ts

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { executeQuery } from "../../../../lib/database";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Handle GET request
  if (req.method === "GET") {
    try {
      const { id } = req.query;

      // Validate required parameters
      if (!id) {
        return res.status(400).json({ error: "Transformation ID is required" });
      }

      // Get transformation metadata
      const metadata = await executeQuery(`
        SELECT *
        FROM transformation_metadata
        WHERE id = '${id}'
      `);

      if (!metadata || metadata.length === 0) {
        return res.status(404).json({ error: "Transformation not found" });
      }

      // Get transformation issues
      const issues = await executeQuery(`
        SELECT *
        FROM transformation_issues
        WHERE transformation_id = '${id}'
      `);

      // Return result
      return res.status(200).json({
        metadata: metadata[0],
        issues,
      });
    } catch (error) {
      console.error("Error in transformation status API:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } else {
    // Method not allowed
    return res.status(405).json({ error: "Method not allowed" });
  }
}
```

## Integration with Existing Components

### Integration with Column Mapping Interface

The Data Transformation Service will be integrated with the Column Mapping Interface to provide a seamless experience for users:

1. User maps columns using the Column Mapping Interface
2. User applies transformation rules using the Transformation Rule Interface
3. User previews the transformed data using the Mapping Preview component
4. User initiates the transformation process
5. The system processes the data and stores it in the normalized format
6. User is notified of the transformation result

### Integration with Global Schema Management

The Data Transformation Service will use the Global Schema Service to:

1. Retrieve schema information for validation
2. Create or update normalized data tables based on schema changes
3. Maintain relationships between data entities

## Testing Strategy

### Unit Tests

- Test each component in isolation
- Mock dependencies for focused testing
- Cover edge cases and error scenarios

### Integration Tests

- Test the interaction between components
- Verify the end-to-end transformation process
- Test with various data scenarios

### Performance Tests

- Test with large datasets
- Measure processing time and resource usage
- Identify bottlenecks and optimization opportunities

## Deployment Considerations

- Database migrations for new tables
- Configuration for batch sizes and processing options
- Monitoring and logging setup
- Error notification mechanisms

## Conclusion

This technical design provides a detailed blueprint for implementing the Data Transformation Service. It covers the core components, database schema, API endpoints, and integration points with existing components. The design is flexible, extensible, and focused on performance and reliability.

import { executeQuery } from "../database";
import { v4 as uuidv4 } from "uuid";
import { ColumnMapping } from "../schemaManagement";
import { GlobalSchema, SchemaColumn } from "../globalSchemaService";

/**
 * Interface for normalized data
 */
export interface NormalizedData {
  id: string;
  projectId: string;
  fileId: string;
  data: any;
  createdAt: Date;
  schemaId?: string;
  version?: number;
}

/**
 * Interface for normalization result
 */
export interface NormalizationResult {
  success: boolean;
  normalizedCount: number;
  errorCount: number;
  errors: NormalizationError[];
  warnings: NormalizationWarning[];
}

/**
 * Interface for normalization error
 */
export interface NormalizationError {
  rowIndex: number;
  column: string;
  value: any;
  error: string;
}

/**
 * Interface for normalization warning
 */
export interface NormalizationWarning {
  rowIndex: number;
  column: string;
  value: any;
  warning: string;
}

/**
 * Interface for data validation options
 */
export interface ValidationOptions {
  skipInvalidRows: boolean;
  validateTypes: boolean;
  validateRequired: boolean;
  validateConstraints: boolean;
}

/**
 * DataNormalizationService class for normalizing and storing data
 */
export class DataNormalizationService {
  /**
   * Normalize and store data according to column mappings
   * @param fileId File ID
   * @param projectId Project ID
   * @param rawData Raw data from the file
   * @param columnMapping Column mapping
   * @param options Validation options
   * @returns Promise<NormalizationResult> Normalization result
   */
  async normalizeAndStoreData(
    fileId: string,
    projectId: string,
    rawData: any[],
    columnMapping: ColumnMapping,
    options: ValidationOptions = {
      skipInvalidRows: false,
      validateTypes: true,
      validateRequired: true,
      validateConstraints: true,
    }
  ): Promise<NormalizationResult> {
    try {
      console.log(
        `[DataNormalizationService] Normalizing data for file ${fileId} in project ${projectId}`
      );

      // Check if the normalized_data table exists
      const tableExists = await this.checkIfTableExists("normalized_data");

      if (!tableExists) {
        // Create the table if it doesn't exist
        await executeQuery(`
          CREATE TABLE normalized_data (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            file_id TEXT NOT NULL,
            schema_id TEXT,
            data JSONB NOT NULL,
            version INTEGER DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }

      // Get the schema to determine the version
      let schemaVersion = 1;
      if (columnMapping.schemaId) {
        const schema = await this.getSchema(columnMapping.schemaId);
        if (schema) {
          schemaVersion = schema.version;
        }
      }

      // Apply column mappings to normalize the data
      const normalizationResult = await this.applyColumnMappings(
        rawData,
        columnMapping,
        options
      );

      // Store each normalized data record
      for (const data of normalizationResult.normalizedData) {
        const id = `normalized_data_${uuidv4()}`;
        await executeQuery(`
          INSERT INTO normalized_data (id, project_id, file_id, schema_id, data, version, created_at)
          VALUES (
            '${id}',
            '${projectId}',
            '${fileId}',
            ${columnMapping.schemaId ? `'${columnMapping.schemaId}'` : "NULL"},
            '${JSON.stringify(data)}',
            ${schemaVersion},
            CURRENT_TIMESTAMP
          )
        `);
      }

      return {
        success: normalizationResult.errors.length === 0,
        normalizedCount: normalizationResult.normalizedData.length,
        errorCount: normalizationResult.errors.length,
        errors: normalizationResult.errors,
        warnings: normalizationResult.warnings,
      };
    } catch (error) {
      console.error(
        `[DataNormalizationService] Error normalizing data for file ${fileId}:`,
        error
      );
      return {
        success: false,
        normalizedCount: 0,
        errorCount: 1,
        errors: [
          {
            rowIndex: -1,
            column: "",
            value: null,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Apply column mappings to normalize data
   * @param rawData Raw data from the file
   * @param columnMapping Column mapping
   * @param options Validation options
   * @returns Promise<{normalizedData: any[], errors: NormalizationError[], warnings: NormalizationWarning[]}> Normalized data with errors and warnings
   */
  private async applyColumnMappings(
    rawData: any[],
    columnMapping: ColumnMapping,
    options: ValidationOptions
  ): Promise<{
    normalizedData: any[];
    errors: NormalizationError[];
    warnings: NormalizationWarning[];
  }> {
    const normalizedData = [];
    const errors: NormalizationError[] = [];
    const warnings: NormalizationWarning[] = [];

    // Get schema columns if schemaId is provided
    let schemaColumns: SchemaColumn[] = [];
    if (columnMapping.schemaId) {
      try {
        const schema = await this.getSchema(columnMapping.schemaId);
        if (schema) {
          schemaColumns = schema.columns;
        }
      } catch (error) {
        console.warn(
          `[DataNormalizationService] Error getting schema ${columnMapping.schemaId}:`,
          error
        );
      }
    }

    // Create a map of schema columns for quick lookup
    const schemaColumnMap = new Map<string, SchemaColumn>();
    for (const column of schemaColumns) {
      schemaColumnMap.set(column.name, column);
    }

    // Process each row
    for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      const normalizedRow: any = {};
      let rowHasErrors = false;

      // Apply each mapping
      for (const [schemaColumn, fileColumn] of Object.entries(
        columnMapping.mappings
      )) {
        // Get the value from the raw data
        let value = row[fileColumn];

        // Transformation rule is not available in this format
        const transformationRule = undefined;

        // Get the schema column definition
        const columnDef = schemaColumnMap.get(schemaColumn);

        try {
          // Apply transformation rule if provided
          if (transformationRule && value !== undefined && value !== null) {
            value = await this.applyTransformation(value, transformationRule);
          }

          // Validate the value against the schema column
          if (columnDef && options.validateTypes) {
            value = this.validateAndConvertType(value, columnDef);
          }

          // Check if required
          if (
            columnDef &&
            options.validateRequired &&
            columnDef.isRequired &&
            (value === undefined || value === null || value === "")
          ) {
            throw new Error(`Required field cannot be empty`);
          }

          // Validate constraints
          if (columnDef && options.validateConstraints) {
            this.validateConstraints(value, columnDef);
          }

          // Set the value in the normalized row
          normalizedRow[schemaColumn] = value;
        } catch (error) {
          rowHasErrors = true;
          errors.push({
            rowIndex,
            column: schemaColumn,
            value,
            error: error instanceof Error ? error.message : "Unknown error",
          });

          // If we're not skipping invalid rows, add the original value
          if (!options.skipInvalidRows) {
            normalizedRow[schemaColumn] = value;
          }
        }
      }

      // Add the row to the normalized data if it doesn't have errors or we're not skipping invalid rows
      if (!rowHasErrors || !options.skipInvalidRows) {
        normalizedData.push(normalizedRow);
      }
    }

    return { normalizedData, errors, warnings };
  }

  /**
   * Apply a transformation rule to a value
   * @param value Value to transform
   * @param transformationRule Transformation rule
   * @returns Promise<any> Transformed value
   */
  private async applyTransformation(
    value: any,
    transformationRule: string
  ): Promise<any> {
    // Simple transformation rules
    if (transformationRule === "UPPER") {
      return typeof value === "string" ? value.toUpperCase() : value;
    } else if (transformationRule === "LOWER") {
      return typeof value === "string" ? value.toLowerCase() : value;
    } else if (transformationRule === "TRIM") {
      return typeof value === "string" ? value.trim() : value;
    } else if (transformationRule === "NUMBER") {
      return Number(value);
    } else if (transformationRule === "STRING") {
      return String(value);
    } else if (transformationRule === "BOOLEAN") {
      return Boolean(value);
    } else if (transformationRule === "DATE") {
      return new Date(value);
    } else if (transformationRule.startsWith("FORMAT_DATE:")) {
      // Format date according to the specified format
      const format = transformationRule.substring("FORMAT_DATE:".length);
      return this.formatDate(value, format);
    } else if (transformationRule.startsWith("REPLACE:")) {
      // Replace text using regex
      const params = transformationRule.substring("REPLACE:".length).split(":");
      if (params.length === 2) {
        const [pattern, replacement] = params;
        return typeof value === "string"
          ? value.replace(new RegExp(pattern, "g"), replacement)
          : value;
      }
    } else if (transformationRule.startsWith("EXTRACT:")) {
      // Extract text using regex
      const pattern = transformationRule.substring("EXTRACT:".length);
      if (typeof value === "string") {
        const match = value.match(new RegExp(pattern));
        return match ? match[0] : value;
      }
    } else if (transformationRule.startsWith("SPLIT:")) {
      // Split text and get a specific index
      const params = transformationRule.substring("SPLIT:".length).split(":");
      if (params.length === 2 && typeof value === "string") {
        const [delimiter, indexStr] = params;
        const index = parseInt(indexStr, 10);
        const parts = value.split(delimiter);
        return parts.length > index ? parts[index] : value;
      }
    } else if (transformationRule === "ROUND") {
      // Round a number
      return typeof value === "number" ? Math.round(value) : value;
    } else if (transformationRule.startsWith("ROUND:")) {
      // Round a number to a specific number of decimal places
      const decimals = parseInt(
        transformationRule.substring("ROUND:".length),
        10
      );
      return typeof value === "number"
        ? parseFloat(value.toFixed(decimals))
        : value;
    } else if (transformationRule === "CAPITALIZE") {
      // Capitalize the first letter of each word
      if (typeof value === "string") {
        return value
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      }
    }

    // For more complex transformations, we would need to implement a rule engine
    // This is a placeholder for future implementation
    console.warn(
      `[DataNormalizationService] Transformation rule not implemented: ${transformationRule}`
    );
    return value;
  }

  /**
   * Format a date according to the specified format
   * @param value Date value
   * @param format Format string
   * @returns string Formatted date
   */
  private formatDate(value: any, format: string): string {
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error("Invalid date");
      }

      // Simple format implementation
      return format
        .replace("YYYY", date.getFullYear().toString())
        .replace("MM", (date.getMonth() + 1).toString().padStart(2, "0"))
        .replace("DD", date.getDate().toString().padStart(2, "0"))
        .replace("HH", date.getHours().toString().padStart(2, "0"))
        .replace("mm", date.getMinutes().toString().padStart(2, "0"))
        .replace("ss", date.getSeconds().toString().padStart(2, "0"));
    } catch (error) {
      console.error(
        `[DataNormalizationService] Error formatting date ${value} with format ${format}:`,
        error
      );
      return value;
    }
  }

  /**
   * Validate and convert a value to the specified type
   * @param value Value to validate
   * @param columnDef Schema column definition
   * @returns any Validated and converted value
   */
  private validateAndConvertType(value: any, columnDef: SchemaColumn): any {
    // Skip validation for null or undefined values
    if (value === null || value === undefined) {
      return value;
    }

    // Convert empty strings to null for non-string types
    if (value === "" && columnDef.type !== "text") {
      return null;
    }

    switch (columnDef.type) {
      case "text":
        return String(value);
      case "integer":
        const intValue = parseInt(value, 10);
        if (isNaN(intValue)) {
          throw new Error(`Value '${value}' is not a valid integer`);
        }
        return intValue;
      case "numeric":
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          throw new Error(`Value '${value}' is not a valid number`);
        }
        return numValue;
      case "boolean":
        if (
          typeof value === "string" &&
          ["true", "false", "1", "0", "yes", "no"].includes(value.toLowerCase())
        ) {
          return ["true", "1", "yes"].includes(value.toLowerCase());
        } else if (typeof value === "boolean") {
          return value;
        } else if (typeof value === "number") {
          return value !== 0;
        }
        throw new Error(`Value '${value}' is not a valid boolean`);
      case "timestamp":
        const dateValue = new Date(value);
        if (isNaN(dateValue.getTime())) {
          throw new Error(`Value '${value}' is not a valid date`);
        }
        return dateValue;
      default:
        return value;
    }
  }

  /**
   * Validate constraints for a value
   * @param value Value to validate
   * @param columnDef Schema column definition
   */
  private validateConstraints(value: any, columnDef: SchemaColumn): void {
    // Skip validation for null or undefined values
    if (value === null || value === undefined) {
      return;
    }

    // Skip if no validation rules
    // Note: validationRules is not part of the SchemaColumn interface
    // This is a placeholder for future implementation
    const validationRules = (columnDef as any).validationRules;
    if (!validationRules || !Array.isArray(validationRules)) {
      return;
    }

    // Check each validation rule
    for (const rule of validationRules) {
      switch (rule.type) {
        case "min":
          if (typeof value === "number" && value < rule.value) {
            throw new Error(
              rule.errorMessage || `Value is less than minimum of ${rule.value}`
            );
          }
          break;
        case "max":
          if (typeof value === "number" && value > rule.value) {
            throw new Error(
              rule.errorMessage || `Value exceeds maximum of ${rule.value}`
            );
          }
          break;
        case "pattern":
          if (
            typeof value === "string" &&
            !new RegExp(rule.value).test(value)
          ) {
            throw new Error(
              rule.errorMessage || `Text does not match the required pattern`
            );
          }
          break;
        case "enum":
          if (Array.isArray(rule.value) && !rule.value.includes(value)) {
            throw new Error(
              rule.errorMessage ||
                `Value must be one of: ${rule.value.join(", ")}`
            );
          }
          break;
        case "custom":
          // Custom validation would be implemented here
          console.warn(
            `[DataNormalizationService] Custom validation not implemented`
          );
          break;
      }
    }
  }

  /**
   * Get normalized data for a project
   * @param projectId Project ID
   * @param schemaId Optional schema ID to filter by
   * @returns Promise<NormalizedData[]> Normalized data
   */
  async getNormalizedData(
    projectId: string,
    schemaId?: string
  ): Promise<NormalizedData[]> {
    try {
      // Check if the normalized_data table exists
      const tableExists = await this.checkIfTableExists("normalized_data");

      if (!tableExists) {
        return [];
      }

      // Build the query
      let query = `
        SELECT id, project_id, file_id, schema_id, data, version, created_at
        FROM normalized_data
        WHERE project_id = '${projectId}'
      `;

      // Add schema filter if provided
      if (schemaId) {
        query += ` AND schema_id = '${schemaId}'`;
      }

      // Add order by
      query += ` ORDER BY created_at DESC`;

      // Get all normalized data for the project
      const result = (await executeQuery(query)) as Array<{
        id: string;
        project_id: string;
        file_id: string;
        schema_id: string;
        data: string;
        version: number;
        created_at: string;
      }>;

      // Convert the result to NormalizedData objects
      return (result || []).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        fileId: row.file_id,
        schemaId: row.schema_id,
        data: JSON.parse(row.data),
        version: row.version,
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      console.error(
        `[DataNormalizationService] Error getting normalized data for project ${projectId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Get normalized data for a file
   * @param fileId File ID
   * @returns Promise<NormalizedData[]> Normalized data
   */
  async getNormalizedDataForFile(fileId: string): Promise<NormalizedData[]> {
    try {
      // Check if the normalized_data table exists
      const tableExists = await this.checkIfTableExists("normalized_data");

      if (!tableExists) {
        return [];
      }

      // Get all normalized data for the file
      const result = (await executeQuery(`
        SELECT id, project_id, file_id, schema_id, data, version, created_at
        FROM normalized_data
        WHERE file_id = '${fileId}'
        ORDER BY created_at DESC
      `)) as Array<{
        id: string;
        project_id: string;
        file_id: string;
        schema_id: string;
        data: string;
        version: number;
        created_at: string;
      }>;

      // Convert the result to NormalizedData objects
      return (result || []).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        fileId: row.file_id,
        schemaId: row.schema_id,
        data: JSON.parse(row.data),
        version: row.version,
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      console.error(
        `[DataNormalizationService] Error getting normalized data for file ${fileId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Get a schema by ID
   * @param schemaId Schema ID
   * @returns Promise<GlobalSchema | null> Schema or null if not found
   */
  private async getSchema(schemaId: string): Promise<GlobalSchema | null> {
    try {
      // Check if the global_schemas table exists
      const tableExists = await this.checkIfTableExists("global_schemas");

      if (!tableExists) {
        return null;
      }

      // Get the schema
      const result = (await executeQuery(`
        SELECT id, user_id, project_id, name, description, columns, version, is_active, created_at, updated_at, previous_version_id
        FROM global_schemas
        WHERE id = '${schemaId}'
      `)) as Array<{
        id: string;
        user_id: string;
        project_id: string;
        name: string;
        description: string;
        columns: string;
        version: number;
        is_active: boolean;
        created_at: string;
        updated_at: string;
        previous_version_id: string;
      }>;

      if (!result || result.length === 0) {
        return null;
      }

      const row = result[0];

      // Convert the result to a GlobalSchema object
      return {
        id: row.id,
        userId: row.user_id,
        projectId: row.project_id,
        name: row.name,
        description: row.description,
        columns: JSON.parse(row.columns),
        version: row.version,
        isActive: row.is_active,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        previousVersionId: row.previous_version_id,
      };
    } catch (error) {
      console.error(
        `[DataNormalizationService] Error getting schema ${schemaId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Check if a table exists
   * @param tableName Table name
   * @returns Promise<boolean> True if the table exists
   */
  private async checkIfTableExists(tableName: string): Promise<boolean> {
    try {
      const result = (await executeQuery(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = '${tableName}'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      return result && result.length > 0 && result[0].exists;
    } catch (error) {
      console.error(
        `[DataNormalizationService] Error checking if table ${tableName} exists:`,
        error
      );
      return false;
    }
  }
}

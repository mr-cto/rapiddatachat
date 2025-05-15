import { executeQuery } from "./database";
import { GlobalSchema } from "./globalSchemaService";

/**
 * Interface for column metadata
 */
export interface ColumnMetadata {
  name: string;
  type: string;
  description?: string;
  isRequired?: boolean;
  isPrimaryKey?: boolean;
  sampleValues?: string[];
}

/**
 * Interface for file column metadata
 */
export interface FileColumnMetadata extends ColumnMetadata {
  index: number;
  originalName: string;
}

/**
 * Interface for schema column metadata
 */
export interface SchemaColumnMetadata extends ColumnMetadata {
  id: string;
  isNewColumn?: boolean;
}

/**
 * Interface for column mapping
 */
export interface ColumnMapping {
  fileColumnName: string;
  schemaColumnId: string;
  transformation?: string;
}

/**
 * Interface for mapping suggestion result
 */
export interface MappingSuggestionResult {
  suggestions: Record<string, string>; // fileColumnName -> schemaColumnId
  confidence: Record<string, number>; // fileColumnName -> confidence score (0-1)
  reason: Record<string, string>; // fileColumnName -> reason for suggestion
}

/**
 * Service for handling column mapping functionality
 */
export class ColumnMappingService {
  /**
   * Get file columns from a file
   * @param fileId File ID
   * @returns Promise<FileColumnMetadata[]> File columns
   */
  async getFileColumns(fileId: string): Promise<FileColumnMetadata[]> {
    try {
      // Get file metadata
      const fileResult = (await executeQuery(`
        SELECT id, filename, filepath, metadata
        FROM files
        WHERE id = '${fileId}'
      `)) as Array<{
        id: string;
        filename: string;
        filepath: string;
        metadata: string;
      }>;

      if (!fileResult || fileResult.length === 0) {
        throw new Error(`File ${fileId} not found`);
      }

      const file = fileResult[0];
      let columnInfo: any[] = [];

      // Parse column info
      try {
        if (file.metadata) {
          if (typeof file.metadata === "string") {
            columnInfo = JSON.parse(file.metadata);
          } else if (typeof file.metadata === "object") {
            columnInfo = file.metadata;
          }
        }
      } catch (parseError) {
        console.error(
          `[ColumnMappingService] Error parsing metadata for file ${fileId}:`,
          parseError
        );
        columnInfo = [];
      }

      // Get sample data
      const sampleDataResult = (await executeQuery(`
        SELECT data as sample_data
        FROM file_data
        WHERE file_id = '${fileId}'
        LIMIT 1
      `)) as Array<{
        sample_data: string;
      }>;

      let sampleData: any[] = [];
      if (sampleDataResult && sampleDataResult.length > 0) {
        try {
          if (typeof sampleDataResult[0].sample_data === "string") {
            sampleData = JSON.parse(sampleDataResult[0].sample_data);
          } else if (typeof sampleDataResult[0].sample_data === "object") {
            sampleData = sampleDataResult[0].sample_data;
          }
        } catch (parseError) {
          console.error(
            `[ColumnMappingService] Error parsing sample data for file ${fileId}:`,
            parseError
          );
        }
      }

      // Extract sample values for each column
      const sampleValues: Record<string, string[]> = {};
      if (sampleData && sampleData.length > 0) {
        const maxSamples = 5;
        columnInfo.forEach((column) => {
          sampleValues[column.name] = [];
          for (let i = 0; i < Math.min(sampleData.length, maxSamples); i++) {
            const value = sampleData[i][column.name];
            if (value !== undefined && value !== null) {
              sampleValues[column.name].push(String(value));
            }
          }
        });
      }

      // Map column info to FileColumnMetadata
      return columnInfo.map((column, index) => ({
        name: column.name,
        originalName: column.originalName || column.name,
        type: column.type || "text",
        description: column.description || "",
        index,
        sampleValues: sampleValues[column.name] || [],
      }));
    } catch (error) {
      console.error(
        `[ColumnMappingService] Error getting file columns for file ${fileId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get schema columns from a schema
   * @param schemaId Schema ID
   * @returns Promise<SchemaColumnMetadata[]> Schema columns
   */
  async getSchemaColumns(schemaId: string): Promise<SchemaColumnMetadata[]> {
    try {
      // First check if the schema exists
      const schemaExists = (await executeQuery(`
        SELECT id
        FROM global_schemas
        WHERE id = '${schemaId}'
      `)) as Array<{
        id: string;
      }>;

      if (!schemaExists || schemaExists.length === 0) {
        throw new Error(`Schema ${schemaId} not found`);
      }

      // Get schema columns from schema_columns table
      const columnsResult = (await executeQuery(`
        SELECT id, name, description, data_type, is_required
        FROM schema_columns
        WHERE global_schema_id = '${schemaId}'
      `)) as Array<{
        id: string;
        name: string;
        description: string;
        data_type: string;
        is_required: boolean;
      }>;

      // Map columns to the expected format
      const columns = columnsResult.map((col) => ({
        id: col.id,
        name: col.name,
        type: col.data_type,
        description: col.description || "",
        isRequired: col.is_required || false,
        isPrimaryKey: false, // Default value since this field is required by the interface but not in the database
      }));

      // Map columns to SchemaColumnMetadata
      return columns.map((column) => ({
        id: column.id || `${column.name}-${Date.now()}`,
        name: column.name,
        type: column.type || "text",
        description: column.description || "",
        isRequired: column.isRequired || false,
        isPrimaryKey: column.isPrimaryKey || false,
      }));
    } catch (error) {
      console.error(
        `[ColumnMappingService] Error getting schema columns for schema ${schemaId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Suggest mappings between file columns and schema columns
   * @param fileColumns File columns
   * @param schemaColumns Schema columns
   * @returns Promise<MappingSuggestionResult> Mapping suggestions
   */
  async suggestMappings(
    fileColumns: FileColumnMetadata[],
    schemaColumns: SchemaColumnMetadata[]
  ): Promise<MappingSuggestionResult> {
    try {
      const suggestions: Record<string, string> = {};
      const confidence: Record<string, number> = {};
      const reason: Record<string, string> = {};

      // For each file column, find the best matching schema column
      for (const fileColumn of fileColumns) {
        let bestMatch: SchemaColumnMetadata | null = null;
        let bestScore = 0;
        let bestReason = "";

        for (const schemaColumn of schemaColumns) {
          // Calculate match score based on various factors
          let score = 0;
          let matchReason = "";

          // Exact name match
          if (
            fileColumn.name.toLowerCase() === schemaColumn.name.toLowerCase()
          ) {
            score += 1;
            matchReason = "Exact name match";
          }
          // Name contains
          else if (
            fileColumn.name
              .toLowerCase()
              .includes(schemaColumn.name.toLowerCase()) ||
            schemaColumn.name
              .toLowerCase()
              .includes(fileColumn.name.toLowerCase())
          ) {
            score += 0.7;
            matchReason = "Partial name match";
          }
          // Original name match
          else if (
            fileColumn.originalName.toLowerCase() ===
            schemaColumn.name.toLowerCase()
          ) {
            score += 0.9;
            matchReason = "Original name match";
          }
          // Original name contains
          else if (
            fileColumn.originalName
              .toLowerCase()
              .includes(schemaColumn.name.toLowerCase()) ||
            schemaColumn.name
              .toLowerCase()
              .includes(fileColumn.originalName.toLowerCase())
          ) {
            score += 0.6;
            matchReason = "Partial original name match";
          }
          // Fuzzy match (simple implementation)
          else {
            const similarity = this.calculateStringSimilarity(
              fileColumn.name.toLowerCase(),
              schemaColumn.name.toLowerCase()
            );
            if (similarity > 0.7) {
              score += similarity * 0.5;
              matchReason = "Fuzzy name match";
            }
          }

          // Type compatibility
          if (this.areTypesCompatible(fileColumn.type, schemaColumn.type)) {
            score += 0.3;
            matchReason += matchReason
              ? ", compatible types"
              : "Compatible types";
          }

          // Update best match if this score is higher
          if (score > bestScore) {
            bestMatch = schemaColumn;
            bestScore = score;
            bestReason = matchReason;
          }
        }

        // Add suggestion if score is above threshold
        if (bestMatch && bestScore > 0.5) {
          suggestions[fileColumn.name] = bestMatch.id;
          confidence[fileColumn.name] = bestScore;
          reason[fileColumn.name] = bestReason;
        }
      }

      return {
        suggestions,
        confidence,
        reason,
      };
    } catch (error) {
      console.error("[ColumnMappingService] Error suggesting mappings:", error);
      throw error;
    }
  }

  /**
   * Save column mappings
   * @param fileId File ID
   * @param schemaId Schema ID
   * @param mappings Column mappings
   * @returns Promise<boolean> Success
   */
  async saveMappings(
    fileId: string,
    schemaId: string,
    mappings: ColumnMapping[]
  ): Promise<boolean> {
    try {
      // Check if the column_mappings table exists
      const tableExists = await this.checkIfTableExists("column_mappings");

      if (!tableExists) {
        // We shouldn't create the table manually as it's managed by Prisma
        // Instead, we'll just return false if the table doesn't exist
        console.error(
          "[ColumnMappingService] column_mappings table doesn't exist"
        );
        return false;
      }

      // Process each mapping individually according to the Prisma schema
      for (const mapping of mappings) {
        // Check if mapping already exists
        const existingResult = (await executeQuery(`
          SELECT id
          FROM column_mappings
          WHERE file_id = '${fileId}'
          AND global_schema_id = '${schemaId}'
          AND schema_column_id = '${mapping.schemaColumnId}'
          AND file_column = '${mapping.fileColumnName}'
        `)) as Array<{
          id: string;
        }>;

        const mappingId =
          existingResult && existingResult.length > 0
            ? existingResult[0].id
            : `mapping_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        // Save mapping
        if (existingResult && existingResult.length > 0) {
          // Update existing mapping
          await executeQuery(`
            UPDATE column_mappings
            SET
              transformation_rule = ${
                mapping.transformation ? `'${mapping.transformation}'` : "NULL"
              },
              updated_at = CURRENT_TIMESTAMP
            WHERE id = '${mappingId}'
          `);
        } else {
          // Insert new mapping
          await executeQuery(`
            INSERT INTO column_mappings (
              id,
              file_id,
              global_schema_id,
              schema_column_id,
              file_column,
              transformation_rule,
              created_at,
              updated_at
            )
            VALUES (
              '${mappingId}',
              '${fileId}',
              '${schemaId}',
              '${mapping.schemaColumnId}',
              '${mapping.fileColumnName}',
              ${
                mapping.transformation ? `'${mapping.transformation}'` : "NULL"
              },
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
          `);
        }
      }

      return true;
    } catch (error) {
      console.error(
        `[ColumnMappingService] Error saving mappings for file ${fileId} and schema ${schemaId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get column mappings
   * @param fileId File ID
   * @param schemaId Schema ID
   * @returns Promise<ColumnMapping[]> Column mappings
   */
  async getMappings(
    fileId: string,
    schemaId: string
  ): Promise<ColumnMapping[]> {
    try {
      // Check if the column_mappings table exists
      const tableExists = await this.checkIfTableExists("column_mappings");

      if (!tableExists) {
        return [];
      }

      // Get mappings from the correct schema
      const result = (await executeQuery(`
        SELECT id, file_id, global_schema_id, schema_column_id, file_column, transformation_rule
        FROM column_mappings
        WHERE file_id = '${fileId}' AND global_schema_id = '${schemaId}'
      `)) as Array<{
        id: string;
        file_id: string;
        global_schema_id: string;
        schema_column_id: string;
        file_column: string;
        transformation_rule: string | null;
      }>;

      if (!result || result.length === 0) {
        return [];
      }

      // Convert to ColumnMapping objects
      const mappings: ColumnMapping[] = result.map((row) => ({
        fileColumnName: row.file_column,
        schemaColumnId: row.schema_column_id,
        transformation: row.transformation_rule || undefined,
      }));

      return mappings;
    } catch (error) {
      console.error(
        `[ColumnMappingService] Error getting mappings for file ${fileId} and schema ${schemaId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Apply mappings to data
   * @param data Data to map
   * @param mappings Column mappings
   * @param schemaColumns Schema columns
   * @returns Promise<any[]> Mapped data
   */
  async applyMappings(
    data: any[],
    mappings: ColumnMapping[],
    schemaColumns: SchemaColumnMetadata[]
  ): Promise<any[]> {
    try {
      // Create a mapping from file column name to schema column id
      const columnMap: Record<string, string> = {};
      const transformationMap: Record<string, string> = {};

      mappings.forEach((mapping) => {
        columnMap[mapping.fileColumnName] = mapping.schemaColumnId;
        if (mapping.transformation) {
          transformationMap[mapping.fileColumnName] = mapping.transformation;
        }
      });

      // Create a mapping from schema column id to schema column name
      const schemaColumnMap: Record<string, SchemaColumnMetadata> = {};
      schemaColumns.forEach((column) => {
        schemaColumnMap[column.id] = column;
      });

      // Apply mappings to data
      return data.map((row) => {
        const mappedRow: Record<string, any> = {};

        // For each file column, map to schema column
        Object.keys(row).forEach((fileColumnName) => {
          const schemaColumnId = columnMap[fileColumnName];
          if (schemaColumnId) {
            const schemaColumn = schemaColumnMap[schemaColumnId];
            if (schemaColumn) {
              let value = row[fileColumnName];

              // Apply transformation if exists
              if (transformationMap[fileColumnName]) {
                value = this.applyTransformation(
                  value,
                  transformationMap[fileColumnName]
                );
              }

              // Convert value to appropriate type
              value = this.convertValueToType(value, schemaColumn.type);

              mappedRow[schemaColumn.name] = value;
            }
          }
        });

        return mappedRow;
      });
    } catch (error) {
      console.error("[ColumnMappingService] Error applying mappings:", error);
      throw error;
    }
  }

  /**
   * Calculate string similarity (Levenshtein distance)
   * @param str1 First string
   * @param str2 Second string
   * @returns number Similarity score (0-1)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Create a matrix of size (len1+1) x (len2+1)
    const matrix: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(null));

    // Initialize the first row and column
    for (let i = 0; i <= len1; i++) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill the matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    // Calculate similarity score (0-1)
    const maxLen = Math.max(len1, len2);
    if (maxLen === 0) return 1; // Both strings are empty
    return 1 - matrix[len1][len2] / maxLen;
  }

  /**
   * Check if two types are compatible
   * @param fileType File column type
   * @param schemaType Schema column type
   * @returns boolean True if types are compatible
   */
  private areTypesCompatible(fileType: string, schemaType: string): boolean {
    // Normalize types
    const normalizedFileType = fileType.toLowerCase();
    const normalizedSchemaType = schemaType.toLowerCase();

    // Exact match
    if (normalizedFileType === normalizedSchemaType) {
      return true;
    }

    // Numeric types
    const numericTypes = [
      "integer",
      "int",
      "number",
      "float",
      "double",
      "decimal",
    ];
    if (
      numericTypes.includes(normalizedFileType) &&
      numericTypes.includes(normalizedSchemaType)
    ) {
      return true;
    }

    // String types
    const stringTypes = ["text", "string", "varchar", "char"];
    if (
      stringTypes.includes(normalizedFileType) &&
      stringTypes.includes(normalizedSchemaType)
    ) {
      return true;
    }

    // Boolean types
    const booleanTypes = ["boolean", "bool"];
    if (
      booleanTypes.includes(normalizedFileType) &&
      booleanTypes.includes(normalizedSchemaType)
    ) {
      return true;
    }

    // Date types
    const dateTypes = ["date", "datetime", "timestamp"];
    if (
      dateTypes.includes(normalizedFileType) &&
      dateTypes.includes(normalizedSchemaType)
    ) {
      return true;
    }

    // String can store any type
    if (stringTypes.includes(normalizedSchemaType)) {
      return true;
    }

    return false;
  }

  /**
   * Apply transformation to a value
   * @param value Value to transform
   * @param transformation Transformation to apply
   * @returns any Transformed value
   */
  private applyTransformation(value: any, transformation: string): any {
    try {
      // Simple transformations
      switch (transformation) {
        case "uppercase":
          return String(value).toUpperCase();
        case "lowercase":
          return String(value).toLowerCase();
        case "trim":
          return String(value).trim();
        case "number":
          return Number(value);
        case "boolean":
          return Boolean(value);
        case "string":
          return String(value);
        default:
          // For more complex transformations, we could use a function
          // but for now, just return the original value
          return value;
      }
    } catch (error) {
      console.error(
        `[ColumnMappingService] Error applying transformation ${transformation}:`,
        error
      );
      return value;
    }
  }

  /**
   * Convert value to appropriate type
   * @param value Value to convert
   * @param type Type to convert to
   * @returns any Converted value
   */
  private convertValueToType(value: any, type: string): any {
    try {
      // Normalize type
      const normalizedType = type.toLowerCase();

      // Handle null/undefined
      if (value === null || value === undefined) {
        return null;
      }

      // Convert based on type
      switch (normalizedType) {
        case "integer":
        case "int":
          return parseInt(value, 10);
        case "float":
        case "double":
        case "decimal":
        case "number":
          return parseFloat(value);
        case "boolean":
        case "bool":
          if (typeof value === "string") {
            const lowerValue = value.toLowerCase();
            return (
              lowerValue === "true" ||
              lowerValue === "yes" ||
              lowerValue === "1"
            );
          }
          return Boolean(value);
        case "date":
        case "datetime":
        case "timestamp":
          return new Date(value).toISOString();
        case "text":
        case "string":
        case "varchar":
        case "char":
        default:
          return String(value);
      }
    } catch (error) {
      console.error(
        `[ColumnMappingService] Error converting value to type ${type}:`,
        error
      );
      return value;
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
        `[ColumnMappingService] Error checking if table ${tableName} exists:`,
        error
      );
      return false;
    }
  }
}

import { executeQuery } from "./database";
import { v4 as uuidv4 } from "uuid";
import { GlobalSchema, SchemaColumn } from "./globalSchemaService";
import {
  SchemaVersionService,
  SchemaComparisonResult,
} from "./schemaVersionService";

/**
 * Interface for file column
 */
export interface FileColumn {
  name: string;
  originalName: string;
  type: string;
  sampleValues: any[];
}

/**
 * Interface for column mapping
 */
export interface ColumnMapping {
  fileColumn: FileColumn;
  schemaColumn?: SchemaColumn;
  matchType: "exact" | "fuzzy" | "none";
  confidence?: number;
}

/**
 * Interface for schema evolution options
 */
export interface SchemaEvolutionOptions {
  addNewColumns?: boolean;
  migrateData?: boolean;
  updateExistingRecords?: boolean;
  createNewVersion?: boolean;
}

/**
 * Interface for schema evolution result
 */
export interface SchemaEvolutionResult {
  success: boolean;
  message: string;
  schema?: GlobalSchema;
  newColumns?: SchemaColumn[];
  modifiedColumns?: {
    columnName: string;
    before: Partial<SchemaColumn>;
    after: Partial<SchemaColumn>;
  }[];
  migrationStatus?: {
    recordsUpdated: number;
    recordsSkipped: number;
    errors: string[];
  };
}

/**
 * Service for handling schema evolution
 */
export class SchemaEvolutionService {
  private schemaVersionService: SchemaVersionService;

  constructor() {
    this.schemaVersionService = new SchemaVersionService();
  }

  /**
   * Identify new columns in a file
   * @param fileColumns Columns from the file
   * @param schemaColumns Columns from the global schema
   * @returns ColumnMapping[] Column mappings
   */
  identifyNewColumns(
    fileColumns: FileColumn[],
    schemaColumns: SchemaColumn[]
  ): ColumnMapping[] {
    const mappings: ColumnMapping[] = [];

    // Create a map of schema column names for quick lookup
    const schemaColumnMap = new Map<string, SchemaColumn>();
    for (const column of schemaColumns) {
      schemaColumnMap.set(column.name.toLowerCase(), column);
    }

    // Process each file column
    for (const fileColumn of fileColumns) {
      // Check for exact match
      const exactMatch = schemaColumnMap.get(fileColumn.name.toLowerCase());
      if (exactMatch) {
        mappings.push({
          fileColumn,
          schemaColumn: exactMatch,
          matchType: "exact",
          confidence: 1.0,
        });
        continue;
      }

      // Check for fuzzy match
      let bestMatch: SchemaColumn | undefined;
      let bestScore = 0;

      for (const schemaColumn of schemaColumns) {
        const score = this.calculateStringSimilarity(
          fileColumn.name.toLowerCase(),
          schemaColumn.name.toLowerCase()
        );

        if (score > bestScore && score > 0.7) {
          bestScore = score;
          bestMatch = schemaColumn;
        }
      }

      if (bestMatch) {
        mappings.push({
          fileColumn,
          schemaColumn: bestMatch,
          matchType: "fuzzy",
          confidence: bestScore,
        });
      } else {
        // No match found, this is a new column
        mappings.push({
          fileColumn,
          matchType: "none",
          confidence: 0,
        });
      }
    }

    return mappings;
  }

  /**
   * Calculate string similarity using Levenshtein distance
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

    // Calculate similarity score
    const maxLen = Math.max(len1, len2);
    if (maxLen === 0) return 1.0; // Both strings are empty
    return 1.0 - matrix[len1][len2] / maxLen;
  }

  /**
   * Evolve schema based on new columns
   * @param schema Current global schema
   * @param newColumns New columns to add
   * @param userId User ID
   * @param options Evolution options
   * @returns Promise<SchemaEvolutionResult> Evolution result
   */
  async evolveSchema(
    schema: GlobalSchema,
    newColumns: FileColumn[],
    userId: string,
    options: SchemaEvolutionOptions = {}
  ): Promise<SchemaEvolutionResult> {
    try {
      // Set default options
      const evolveOptions: SchemaEvolutionOptions = {
        addNewColumns: true,
        migrateData: false,
        updateExistingRecords: false,
        createNewVersion: true,
        ...options,
      };

      // Create a copy of the schema
      const updatedSchema: GlobalSchema = {
        ...schema,
        columns: [...schema.columns],
        version: schema.version + 1,
        previousVersionId: schema.id,
        updatedAt: new Date(),
      };

      // Convert file columns to schema columns
      const columnsToAdd: SchemaColumn[] = newColumns.map((fileColumn) => ({
        id: `col_${uuidv4()}`,
        name: fileColumn.name,
        type: this.mapFileTypeToSchemaType(fileColumn.type),
        description: `Added from file column: ${fileColumn.originalName}`,
        isRequired: false,
        isNewColumn: true,
      }));

      // Add new columns to the schema
      if (evolveOptions.addNewColumns) {
        updatedSchema.columns = [...updatedSchema.columns, ...columnsToAdd];
      }

      // Create a new schema version if requested
      if (evolveOptions.createNewVersion) {
        await this.schemaVersionService.createSchemaVersion(
          schema,
          userId,
          `Added ${columnsToAdd.length} new columns from file upload`
        );
      }

      // Update the schema in the database
      await executeQuery(`
        UPDATE global_schemas
        SET
          columns = '${JSON.stringify(updatedSchema.columns)}',
          updated_at = CURRENT_TIMESTAMP,
          version = ${updatedSchema.version},
          previous_version_id = '${updatedSchema.previousVersionId}'
        WHERE id = '${updatedSchema.id}'
      `);

      // Migrate data if requested
      let migrationStatus;
      if (evolveOptions.migrateData) {
        migrationStatus = await this.migrateData(
          schema,
          columnsToAdd,
          evolveOptions.updateExistingRecords || false
        );
      }

      return {
        success: true,
        message: `Schema evolved successfully. Added ${columnsToAdd.length} new columns.`,
        schema: updatedSchema,
        newColumns: columnsToAdd,
        migrationStatus,
      };
    } catch (error) {
      console.error(
        `[SchemaEvolutionService] Error evolving schema ${schema.id}:`,
        error
      );
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Map file column type to schema column type
   * @param fileType File column type
   * @returns string Schema column type
   */
  private mapFileTypeToSchemaType(fileType: string): string {
    switch (fileType.toLowerCase()) {
      case "number":
      case "integer":
      case "float":
      case "double":
        return "numeric";
      case "boolean":
        return "boolean";
      case "date":
      case "datetime":
      case "timestamp":
        return "timestamp";
      default:
        return "text";
    }
  }

  /**
   * Migrate data for new columns
   * @param schema Global schema
   * @param newColumns New columns
   * @param updateExistingRecords Whether to update existing records
   * @returns Promise<{ recordsUpdated: number; recordsSkipped: number; errors: string[] }> Migration status
   */
  private async migrateData(
    schema: GlobalSchema,
    newColumns: SchemaColumn[],
    updateExistingRecords: boolean
  ): Promise<{
    recordsUpdated: number;
    recordsSkipped: number;
    errors: string[];
  }> {
    try {
      // Check if the normalized_records table exists
      const tableExists = await this.checkIfTableExists("normalized_records");

      if (!tableExists) {
        return {
          recordsUpdated: 0,
          recordsSkipped: 0,
          errors: ["Normalized records table does not exist"],
        };
      }

      // Get all records for the schema
      const result = (await executeQuery(`
        SELECT id, data
        FROM normalized_records
        WHERE schema_id = '${schema.id}'
      `)) as Array<{
        id: string;
        data: string;
      }>;

      if (!result || result.length === 0) {
        return {
          recordsUpdated: 0,
          recordsSkipped: 0,
          errors: [],
        };
      }

      let recordsUpdated = 0;
      let recordsSkipped = 0;
      const errors: string[] = [];

      // Update each record
      for (const record of result) {
        try {
          // Parse data
          let data: Record<string, any> = {};
          if (typeof record.data === "string") {
            data = JSON.parse(record.data);
          } else if (typeof record.data === "object") {
            data = record.data as Record<string, any>;
          }

          // Add new columns with default values
          let updated = false;
          for (const column of newColumns) {
            if (!(column.name in data) || updateExistingRecords) {
              data[column.name] = this.getDefaultValueForType(column.type);
              updated = true;
            }
          }

          // Update the record if needed
          if (updated) {
            await executeQuery(`
              UPDATE normalized_records
              SET data = '${JSON.stringify(data)}'
              WHERE id = '${record.id}'
            `);
            recordsUpdated++;
          } else {
            recordsSkipped++;
          }
        } catch (error) {
          console.error(
            `[SchemaEvolutionService] Error migrating data for record ${record.id}:`,
            error
          );
          errors.push(
            `Error migrating data for record ${record.id}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
          recordsSkipped++;
        }
      }

      return {
        recordsUpdated,
        recordsSkipped,
        errors,
      };
    } catch (error) {
      console.error(
        `[SchemaEvolutionService] Error migrating data for schema ${schema.id}:`,
        error
      );
      return {
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [
          `Error migrating data: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
      };
    }
  }

  /**
   * Get default value for a type
   * @param type Column type
   * @returns any Default value
   */
  private getDefaultValueForType(type: string): any {
    switch (type.toLowerCase()) {
      case "numeric":
        return 0;
      case "boolean":
        return false;
      case "timestamp":
        return null;
      default:
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
        `[SchemaEvolutionService] Error checking if table ${tableName} exists:`,
        error
      );
      return false;
    }
  }
}

export default new SchemaEvolutionService();

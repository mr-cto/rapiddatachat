import { SchemaService, SchemaColumn } from "../schemaManagement";
import { executeQuery } from "../database";
import { v4 as uuidv4 } from "uuid";

/**
 * Interface for column mapping
 */
export interface ColumnMapping {
  fileColumnName: string;
  schemaColumnId: string;
}

/**
 * Interface for mapping definition
 */
export interface MappingDefinition {
  id: string;
  name: string;
  description?: string;
  sourceType: string;
  targetType: string;
  mappings: ColumnMapping[];
  transformationRules?: Record<string, any[]>;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  projectId: string;
}

/**
 * Interface for mapping result
 */
export interface MappingResult {
  success: boolean;
  mappedData: any[];
  unmappedColumns: string[];
  errors: MappingError[];
}

/**
 * Interface for mapping error
 */
export interface MappingError {
  code: string;
  message: string;
  columnName?: string;
  rowIndex?: number;
}

/**
 * Interface for mapping options
 */
export interface MappingOptions {
  includeUnmappedColumns?: boolean;
  defaultValues?: Record<string, any>;
  validationLevel?: "strict" | "lenient" | "none";
}

/**
 * Mapping Engine class
 *
 * Responsible for applying column mappings between source data and target schema
 */
export class MappingEngine {
  private schemaService: SchemaService;

  /**
   * Constructor
   */
  constructor() {
    this.schemaService = new SchemaService();
  }

  /**
   * Apply mappings to a batch of data
   *
   * @param data Source data
   * @param mappings Column mappings
   * @param schemaId Target schema ID
   * @param options Mapping options
   * @returns Mapped data
   */
  async applyMappings(
    data: any[],
    mappings: ColumnMapping[],
    schemaId: string,
    options?: MappingOptions
  ): Promise<MappingResult> {
    try {
      // Get schema columns
      const schemaColumns = await this.schemaService.getSchemaColumns(schemaId);

      // Track unmapped columns
      const unmappedColumns: string[] = [];
      const errors: MappingError[] = [];

      // Map data according to mappings
      const mappedData = data.map((row, rowIndex) => {
        const mappedRow: Record<string, any> = {};

        // Apply mappings
        mappings.forEach((mapping) => {
          const schemaColumn = schemaColumns.find(
            (col: SchemaColumn) => col.id === mapping.schemaColumnId
          );

          if (schemaColumn) {
            // Get value from source
            const value = row[mapping.fileColumnName];

            // Apply mapping
            mappedRow[schemaColumn.name] = value;
          }
        });

        // Include unmapped columns if requested
        if (options?.includeUnmappedColumns) {
          Object.entries(row).forEach(([key, value]) => {
            const isAlreadyMapped = mappings.some(
              (mapping) => mapping.fileColumnName === key
            );

            if (!isAlreadyMapped) {
              mappedRow[key] = value;

              // Track unmapped column
              if (!unmappedColumns.includes(key)) {
                unmappedColumns.push(key);
              }
            }
          });
        }

        // Apply default values
        if (options?.defaultValues) {
          Object.entries(options.defaultValues).forEach(([key, value]) => {
            if (mappedRow[key] === undefined) {
              mappedRow[key] = value;
            }
          });
        }

        // Validate required fields
        if (options?.validationLevel !== "none") {
          schemaColumns.forEach((column: SchemaColumn) => {
            if (
              column.isRequired &&
              (mappedRow[column.name] === undefined ||
                mappedRow[column.name] === null)
            ) {
              errors.push({
                code: "REQUIRED_FIELD_MISSING",
                message: `Required field "${column.name}" is missing`,
                columnName: column.name,
                rowIndex,
              });
            }
          });
        }

        return mappedRow;
      });

      return {
        success: errors.length === 0,
        mappedData,
        unmappedColumns,
        errors,
      };
    } catch (error) {
      console.error("Error applying mappings:", error);
      return {
        success: false,
        mappedData: [],
        unmappedColumns: [],
        errors: [
          {
            code: "MAPPING_ERROR",
            message: error instanceof Error ? error.message : "Unknown error",
          },
        ],
      };
    }
  }

  /**
   * Save mapping definition
   *
   * @param definition Mapping definition
   * @returns Saved mapping definition
   */
  async saveMappingDefinition(
    definition: Omit<MappingDefinition, "id" | "createdAt" | "updatedAt">
  ): Promise<MappingDefinition> {
    try {
      // Check if mapping_definitions table exists
      const tableExists = await this.checkIfTableExists("mapping_definitions");

      if (!tableExists) {
        // Create table if it doesn't exist
        await executeQuery(`
          CREATE TABLE mapping_definitions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            source_type TEXT NOT NULL,
            target_type TEXT NOT NULL,
            mappings JSONB NOT NULL,
            transformation_rules JSONB,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            user_id TEXT NOT NULL,
            project_id TEXT NOT NULL
          )
        `);
      }

      // Generate ID
      const id = `mapping_${uuidv4()}`;
      const now = new Date();

      // Insert mapping definition
      await executeQuery(`
        INSERT INTO mapping_definitions (
          id,
          name,
          description,
          source_type,
          target_type,
          mappings,
          transformation_rules,
          created_at,
          updated_at,
          user_id,
          project_id
        )
        VALUES (
          '${id}',
          '${definition.name}',
          ${definition.description ? `'${definition.description}'` : "NULL"},
          '${definition.sourceType}',
          '${definition.targetType}',
          '${JSON.stringify(definition.mappings)}',
          ${
            definition.transformationRules
              ? `'${JSON.stringify(definition.transformationRules)}'`
              : "NULL"
          },
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          '${definition.userId}',
          '${definition.projectId}'
        )
      `);

      // Return saved definition
      return {
        ...definition,
        id,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      console.error("Error saving mapping definition:", error);
      throw error;
    }
  }

  /**
   * Get mapping definition by ID
   *
   * @param id Mapping definition ID
   * @returns Mapping definition
   */
  async getMappingDefinition(id: string): Promise<MappingDefinition | null> {
    try {
      // Check if mapping_definitions table exists
      const tableExists = await this.checkIfTableExists("mapping_definitions");

      if (!tableExists) {
        return null;
      }

      // Get mapping definition
      const result = (await executeQuery(`
        SELECT *
        FROM mapping_definitions
        WHERE id = '${id}'
      `)) as Array<any>;

      if (!result || result.length === 0) {
        return null;
      }

      const definition = result[0];

      // Parse mappings and transformation rules
      let mappings: ColumnMapping[] = [];
      let transformationRules: Record<string, any[]> | undefined;

      try {
        mappings = JSON.parse(definition.mappings);
      } catch (error) {
        console.error("Error parsing mappings:", error);
      }

      try {
        if (definition.transformation_rules) {
          transformationRules = JSON.parse(definition.transformation_rules);
        }
      } catch (error) {
        console.error("Error parsing transformation rules:", error);
      }

      // Return mapping definition
      return {
        id: definition.id,
        name: definition.name,
        description: definition.description,
        sourceType: definition.source_type,
        targetType: definition.target_type,
        mappings,
        transformationRules,
        createdAt: new Date(definition.created_at),
        updatedAt: new Date(definition.updated_at),
        userId: definition.user_id,
        projectId: definition.project_id,
      };
    } catch (error) {
      console.error("Error getting mapping definition:", error);
      return null;
    }
  }

  /**
   * Get mapping definitions for a project
   *
   * @param projectId Project ID
   * @returns Mapping definitions
   */
  async getMappingDefinitionsForProject(
    projectId: string
  ): Promise<MappingDefinition[]> {
    try {
      // Check if mapping_definitions table exists
      const tableExists = await this.checkIfTableExists("mapping_definitions");

      if (!tableExists) {
        return [];
      }

      // Get mapping definitions
      const result = (await executeQuery(`
        SELECT *
        FROM mapping_definitions
        WHERE project_id = '${projectId}'
        ORDER BY updated_at DESC
      `)) as Array<any>;

      if (!result || result.length === 0) {
        return [];
      }

      // Parse mapping definitions
      return result.map((definition: any) => {
        // Parse mappings and transformation rules
        let mappings: ColumnMapping[] = [];
        let transformationRules: Record<string, any[]> | undefined;

        try {
          mappings = JSON.parse(definition.mappings);
        } catch (error) {
          console.error("Error parsing mappings:", error);
        }

        try {
          if (definition.transformation_rules) {
            transformationRules = JSON.parse(definition.transformation_rules);
          }
        } catch (error) {
          console.error("Error parsing transformation rules:", error);
        }

        // Return mapping definition
        return {
          id: definition.id,
          name: definition.name,
          description: definition.description,
          sourceType: definition.source_type,
          targetType: definition.target_type,
          mappings,
          transformationRules,
          createdAt: new Date(definition.created_at),
          updatedAt: new Date(definition.updated_at),
          userId: definition.user_id,
          projectId: definition.project_id,
        };
      });
    } catch (error) {
      console.error("Error getting mapping definitions for project:", error);
      return [];
    }
  }

  /**
   * Update mapping definition
   *
   * @param id Mapping definition ID
   * @param definition Mapping definition
   * @returns Updated mapping definition
   */
  async updateMappingDefinition(
    id: string,
    definition: Partial<
      Omit<MappingDefinition, "id" | "createdAt" | "updatedAt">
    >
  ): Promise<MappingDefinition | null> {
    try {
      // Check if mapping_definitions table exists
      const tableExists = await this.checkIfTableExists("mapping_definitions");

      if (!tableExists) {
        return null;
      }

      // Get existing mapping definition
      const existingDefinition = await this.getMappingDefinition(id);

      if (!existingDefinition) {
        return null;
      }

      // Build update query
      let updateQuery =
        "UPDATE mapping_definitions SET updated_at = CURRENT_TIMESTAMP";

      if (definition.name) {
        updateQuery += `, name = '${definition.name}'`;
      }

      if (definition.description !== undefined) {
        updateQuery += `, description = ${
          definition.description ? `'${definition.description}'` : "NULL"
        }`;
      }

      if (definition.sourceType) {
        updateQuery += `, source_type = '${definition.sourceType}'`;
      }

      if (definition.targetType) {
        updateQuery += `, target_type = '${definition.targetType}'`;
      }

      if (definition.mappings) {
        updateQuery += `, mappings = '${JSON.stringify(definition.mappings)}'`;
      }

      if (definition.transformationRules !== undefined) {
        updateQuery += `, transformation_rules = ${
          definition.transformationRules
            ? `'${JSON.stringify(definition.transformationRules)}'`
            : "NULL"
        }`;
      }

      // Execute update query
      await executeQuery(`
        ${updateQuery}
        WHERE id = '${id}'
      `);

      // Get updated mapping definition
      return this.getMappingDefinition(id);
    } catch (error) {
      console.error("Error updating mapping definition:", error);
      return null;
    }
  }

  /**
   * Delete mapping definition
   *
   * @param id Mapping definition ID
   * @returns Success
   */
  async deleteMappingDefinition(id: string): Promise<boolean> {
    try {
      // Check if mapping_definitions table exists
      const tableExists = await this.checkIfTableExists("mapping_definitions");

      if (!tableExists) {
        return false;
      }

      // Delete mapping definition
      await executeQuery(`
        DELETE FROM mapping_definitions
        WHERE id = '${id}'
      `);

      return true;
    } catch (error) {
      console.error("Error deleting mapping definition:", error);
      return false;
    }
  }

  /**
   * Check if a table exists
   *
   * @param tableName Table name
   * @returns True if the table exists
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
      console.error(`Error checking if table ${tableName} exists:`, error);
      return false;
    }
  }
}

export default new MappingEngine();

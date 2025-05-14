import { executeQuery } from "./database";
import { v4 as uuidv4 } from "uuid";

/**
 * Interface for schema column
 */
export interface SchemaColumn {
  id: string;
  name: string;
  type: string;
  description?: string;
  isRequired?: boolean;
  isPrimaryKey?: boolean;
  defaultValue?: string;
  derivationFormula?: string;
  isNewColumn?: boolean;
}

/**
 * Interface for global schema
 */
export interface GlobalSchema {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  description?: string;
  columns: SchemaColumn[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  version: number;
  previousVersionId?: string;
}

/**
 * Interface for column mapping
 */
export interface ColumnMapping {
  fileId: string;
  schemaId: string;
  mappings: Record<string, string>;
}

/**
 * Service for managing schemas
 */
export class SchemaService {
  /**
   * Get column mapping for a file and schema
   * @param fileId File ID
   * @param schemaId Schema ID
   * @returns Promise<ColumnMapping | null> Column mapping or null if not found
   */
  async getColumnMapping(
    fileId: string,
    schemaId: string
  ): Promise<ColumnMapping | null> {
    try {
      // Check if the column_mappings table exists
      const tableExists = await this.checkIfTableExists("column_mappings");

      if (!tableExists) {
        return null;
      }

      // Get mapping
      const result = (await executeQuery(`
        SELECT file_id, schema_id, mappings
        FROM column_mappings
        WHERE file_id = '${fileId}' AND schema_id = '${schemaId}'
      `)) as Array<{
        file_id: string;
        schema_id: string;
        mappings: string;
      }>;

      if (!result || result.length === 0) {
        return null;
      }

      const mapping = result[0];

      // Parse mappings
      let parsedMappings: Record<string, string> = {};
      try {
        if (mapping.mappings) {
          if (typeof mapping.mappings === "string") {
            parsedMappings = JSON.parse(mapping.mappings);
          } else if (typeof mapping.mappings === "object") {
            parsedMappings = mapping.mappings as unknown as Record<
              string,
              string
            >;
          }
        }
      } catch (parseError) {
        console.error(
          `[SchemaService] Error parsing mappings for file ${fileId} and schema ${schemaId}:`,
          parseError
        );
        parsedMappings = {};
      }

      // Return mapping
      return {
        fileId: mapping.file_id,
        schemaId: mapping.schema_id,
        mappings: parsedMappings,
      };
    } catch (error) {
      console.error(
        `[SchemaService] Error getting column mapping for file ${fileId} and schema ${schemaId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Save column mapping
   * @param mapping Column mapping
   * @returns Promise<boolean> Success
   */
  async saveColumnMapping(mapping: ColumnMapping): Promise<boolean> {
    try {
      // Check if the column_mappings table exists
      const tableExists = await this.checkIfTableExists("column_mappings");

      if (!tableExists) {
        // Create the table if it doesn't exist
        await executeQuery(`
          CREATE TABLE column_mappings (
            file_id TEXT NOT NULL,
            schema_id TEXT NOT NULL,
            mappings JSONB NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (file_id, schema_id)
          )
        `);
      }

      // Check if mapping already exists
      const existingMapping = await this.getColumnMapping(
        mapping.fileId,
        mapping.schemaId
      );

      if (existingMapping) {
        // Update existing mapping
        await executeQuery(`
          UPDATE column_mappings
          SET mappings = '${JSON.stringify(mapping.mappings)}',
              updated_at = CURRENT_TIMESTAMP
          WHERE file_id = '${mapping.fileId}' AND schema_id = '${
          mapping.schemaId
        }'
        `);
      } else {
        // Insert new mapping
        await executeQuery(`
          INSERT INTO column_mappings (
            file_id,
            schema_id,
            mappings,
            created_at,
            updated_at
          )
          VALUES (
            '${mapping.fileId}',
            '${mapping.schemaId}',
            '${JSON.stringify(mapping.mappings)}',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `);
      }

      return true;
    } catch (error) {
      console.error(
        `[SchemaService] Error saving column mapping for file ${mapping.fileId} and schema ${mapping.schemaId}:`,
        error
      );
      throw error;
    }
  }
  /**
   * Create a new global schema
   * @param userId User ID
   * @param projectId Project ID
   * @param name Schema name
   * @param description Schema description
   * @param columns Schema columns
   * @returns Promise<GlobalSchema> Created schema
   */
  async createGlobalSchema(
    userId: string,
    projectId: string,
    name: string,
    description: string,
    columns: Omit<SchemaColumn, "id">[]
  ): Promise<GlobalSchema> {
    try {
      // Check if the global_schemas table exists
      const tableExists = await this.checkIfTableExists("global_schemas");

      if (!tableExists) {
        // Create the table if it doesn't exist
        await executeQuery(`
          CREATE TABLE global_schemas (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            columns JSONB NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            version INTEGER NOT NULL DEFAULT 1,
            previous_version_id TEXT
          )
        `);
      }

      // Generate schema ID
      const schemaId = `schema_${uuidv4()}`;

      // Add IDs to columns
      const columnsWithIds = columns.map((column) => ({
        ...column,
        id: `col_${uuidv4()}`,
      }));

      // Create schema
      await executeQuery(`
        INSERT INTO global_schemas (
          id,
          user_id,
          project_id,
          name,
          description,
          columns,
          created_at,
          updated_at,
          is_active,
          version
        )
        VALUES (
          '${schemaId}',
          '${userId}',
          '${projectId}',
          '${name}',
          ${description ? `'${description}'` : "NULL"},
          '${JSON.stringify(columnsWithIds)}',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          TRUE,
          1
        )
      `);

      // Return created schema
      return {
        id: schemaId,
        userId,
        projectId,
        name,
        description,
        columns: columnsWithIds,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        version: 1,
      };
    } catch (error) {
      console.error("[SchemaService] Error creating schema:", error);
      throw error;
    }
  }

  /**
   * Get global schema by ID
   * @param schemaId Schema ID
   * @returns Promise<GlobalSchema | null> Schema or null if not found
   */
  async getGlobalSchemaById(schemaId: string): Promise<GlobalSchema | null> {
    try {
      // Check if the global_schemas table exists
      const tableExists = await this.checkIfTableExists("global_schemas");

      if (!tableExists) {
        return null;
      }

      // Get schema
      const result = (await executeQuery(`
        SELECT id, user_id, project_id, name, description, columns, created_at, updated_at, is_active, version, previous_version_id
        FROM global_schemas
        WHERE id = '${schemaId}'
      `)) as Array<{
        id: string;
        user_id: string;
        project_id: string;
        name: string;
        description: string;
        columns: string;
        created_at: string;
        updated_at: string;
        is_active: boolean;
        version: number;
        previous_version_id: string;
      }>;

      if (!result || result.length === 0) {
        return null;
      }

      const schema = result[0];

      // Parse columns
      let parsedColumns: SchemaColumn[] = [];
      try {
        if (schema.columns) {
          if (typeof schema.columns === "string") {
            parsedColumns = JSON.parse(schema.columns);
          } else if (typeof schema.columns === "object") {
            parsedColumns = schema.columns as unknown as SchemaColumn[];
          }
        }
      } catch (parseError) {
        console.error(
          `[SchemaService] Error parsing columns for schema ${schemaId}:`,
          parseError
        );
        parsedColumns = [];
      }

      // Ensure all columns have IDs
      parsedColumns = parsedColumns.map((column) => ({
        ...column,
        id: column.id || `col_${uuidv4()}`,
      }));

      // Return schema
      return {
        id: schema.id,
        userId: schema.user_id,
        projectId: schema.project_id,
        name: schema.name,
        description: schema.description,
        columns: parsedColumns,
        createdAt: new Date(schema.created_at),
        updatedAt: new Date(schema.updated_at),
        isActive: schema.is_active,
        version: schema.version,
        previousVersionId: schema.previous_version_id,
      };
    } catch (error) {
      console.error(`[SchemaService] Error getting schema ${schemaId}:`, error);
      throw error;
    }
  }

  /**
   * Get schema columns
   * @param schemaId Schema ID
   * @returns Promise<SchemaColumn[]> Schema columns
   */
  async getSchemaColumns(schemaId: string): Promise<SchemaColumn[]> {
    try {
      const schema = await this.getGlobalSchemaById(schemaId);
      return schema ? schema.columns : [];
    } catch (error) {
      console.error(
        `[SchemaService] Error getting schema columns for schema ${schemaId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Get global schemas for a project
   * @param projectId Project ID
   * @param activeOnly Only return active schemas
   * @returns Promise<GlobalSchema[]> Schemas
   */
  async getGlobalSchemasForProject(
    projectId: string,
    activeOnly = false
  ): Promise<GlobalSchema[]> {
    try {
      // Check if the global_schemas table exists
      const tableExists = await this.checkIfTableExists("global_schemas");

      if (!tableExists) {
        return [];
      }

      // Get schemas
      const result = (await executeQuery(`
        SELECT id, user_id, project_id, name, description, columns, created_at, updated_at, is_active, version, previous_version_id
        FROM global_schemas
        WHERE project_id = '${projectId}'
        ${activeOnly ? "AND is_active = TRUE" : ""}
        ORDER BY created_at DESC
      `)) as Array<{
        id: string;
        user_id: string;
        project_id: string;
        name: string;
        description: string;
        columns: string;
        created_at: string;
        updated_at: string;
        is_active: boolean;
        version: number;
        previous_version_id: string;
      }>;

      if (!result || result.length === 0) {
        return [];
      }

      // Parse schemas
      return result.map((schema) => {
        // Parse columns
        let parsedColumns: SchemaColumn[] = [];
        try {
          if (schema.columns) {
            if (typeof schema.columns === "string") {
              parsedColumns = JSON.parse(schema.columns);
            } else if (typeof schema.columns === "object") {
              parsedColumns = schema.columns as unknown as SchemaColumn[];
            }
          }
        } catch (parseError) {
          console.error(
            `[SchemaService] Error parsing columns for schema ${schema.id}:`,
            parseError
          );
          parsedColumns = [];
        }

        // Ensure all columns have IDs
        parsedColumns = parsedColumns.map((column) => ({
          ...column,
          id: column.id || `col_${uuidv4()}`,
        }));

        // Return schema
        return {
          id: schema.id,
          userId: schema.user_id,
          projectId: schema.project_id,
          name: schema.name,
          description: schema.description,
          columns: parsedColumns,
          createdAt: new Date(schema.created_at),
          updatedAt: new Date(schema.updated_at),
          isActive: schema.is_active,
          version: schema.version,
          previousVersionId: schema.previous_version_id,
        };
      });
    } catch (error) {
      console.error(
        `[SchemaService] Error getting schemas for project ${projectId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Update a global schema
   * @param schema Schema to update
   * @returns Promise<GlobalSchema> Updated schema
   */
  async updateGlobalSchema(schema: GlobalSchema): Promise<GlobalSchema> {
    try {
      // Check if the global_schemas table exists
      const tableExists = await this.checkIfTableExists("global_schemas");

      if (!tableExists) {
        throw new Error("Global schemas table does not exist");
      }

      // Ensure all columns have IDs
      const columnsWithIds = schema.columns.map((column) => ({
        ...column,
        id: column.id || `col_${uuidv4()}`,
      }));

      // Update schema
      await executeQuery(`
        UPDATE global_schemas
        SET
          name = '${schema.name}',
          description = ${
            schema.description ? `'${schema.description}'` : "NULL"
          },
          columns = '${JSON.stringify(columnsWithIds)}',
          updated_at = CURRENT_TIMESTAMP,
          is_active = ${schema.isActive},
          version = ${schema.version},
          previous_version_id = ${
            schema.previousVersionId ? `'${schema.previousVersionId}'` : "NULL"
          }
        WHERE id = '${schema.id}'
      `);

      // Return updated schema
      return {
        ...schema,
        columns: columnsWithIds,
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error(
        `[SchemaService] Error updating schema ${schema.id}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete a global schema
   * @param schemaId Schema ID
   * @returns Promise<boolean> Success
   */
  async deleteGlobalSchema(schemaId: string): Promise<boolean> {
    try {
      // Check if the global_schemas table exists
      const tableExists = await this.checkIfTableExists("global_schemas");

      if (!tableExists) {
        return false;
      }

      // Delete schema
      await executeQuery(`
        DELETE FROM global_schemas
        WHERE id = '${schemaId}'
      `);

      return true;
    } catch (error) {
      console.error(
        `[SchemaService] Error deleting schema ${schemaId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Set active schema for a project
   * @param projectId Project ID
   * @param schemaId Schema ID
   * @returns Promise<boolean> Success
   */
  async setActiveSchema(projectId: string, schemaId: string): Promise<boolean> {
    try {
      // Check if the global_schemas table exists
      const tableExists = await this.checkIfTableExists("global_schemas");

      if (!tableExists) {
        return false;
      }

      // Check if schema exists
      const schemaExists = await this.getGlobalSchemaById(schemaId);

      if (!schemaExists) {
        return false;
      }

      // Set all schemas for the project to inactive
      await executeQuery(`
        UPDATE global_schemas
        SET is_active = FALSE
        WHERE project_id = '${projectId}'
      `);

      // Set the specified schema to active
      await executeQuery(`
        UPDATE global_schemas
        SET is_active = TRUE
        WHERE id = '${schemaId}'
      `);

      return true;
    } catch (error) {
      console.error(
        `[SchemaService] Error setting active schema ${schemaId} for project ${projectId}:`,
        error
      );
      throw error;
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
        `[SchemaService] Error checking if table ${tableName} exists:`,
        error
      );
      return false;
    }
  }
}

export default new SchemaService();

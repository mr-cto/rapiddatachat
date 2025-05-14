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
 * Service for managing global schemas
 */
export class GlobalSchemaService {
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
      console.error("[GlobalSchemaService] Error creating schema:", error);
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
          `[GlobalSchemaService] Error parsing columns for schema ${schemaId}:`,
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
      console.error(
        `[GlobalSchemaService] Error getting schema ${schemaId}:`,
        error
      );
      throw error;
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
            `[GlobalSchemaService] Error parsing columns for schema ${schema.id}:`,
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
        `[GlobalSchemaService] Error getting schemas for project ${projectId}:`,
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
        `[GlobalSchemaService] Error updating schema ${schema.id}:`,
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
        `[GlobalSchemaService] Error deleting schema ${schemaId}:`,
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
        `[GlobalSchemaService] Error setting active schema ${schemaId} for project ${projectId}:`,
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
        `[GlobalSchemaService] Error checking if table ${tableName} exists:`,
        error
      );
      return false;
    }
  }

  /**
   * Get column mapping for a file and schema
   * @param fileId File ID
   * @param schemaId Schema ID
   * @returns Promise<any> Column mapping
   */
  async getColumnMapping(fileId: string, schemaId: string): Promise<any> {
    try {
      // Check if the column_mappings table exists
      const tableExists = await this.checkIfTableExists("column_mappings");

      if (!tableExists) {
        return null;
      }

      // Get column mapping
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
        transformation_rule: string;
      }>;

      if (!result || result.length === 0) {
        return null;
      }

      // Group by schema column ID
      const mappingsBySchemaColumn: Record<string, any> = {};

      for (const mapping of result) {
        mappingsBySchemaColumn[mapping.schema_column_id] = {
          id: mapping.id,
          fileId: mapping.file_id,
          globalSchemaId: mapping.global_schema_id,
          schemaColumnId: mapping.schema_column_id,
          fileColumn: mapping.file_column,
          transformationRule: mapping.transformation_rule,
        };
      }

      return mappingsBySchemaColumn;
    } catch (error) {
      console.error(
        `[GlobalSchemaService] Error getting column mapping for file ${fileId} and schema ${schemaId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get global schemas for a user and optionally for a specific project
   * @param userId User ID
   * @param projectId Optional Project ID
   * @returns Promise<GlobalSchema[]> Schemas
   */
  async getGlobalSchemas(
    userId: string,
    projectId?: string
  ): Promise<GlobalSchema[]> {
    try {
      // Check if the global_schemas table exists
      const tableExists = await this.checkIfTableExists("global_schemas");

      if (!tableExists) {
        return [];
      }

      // Build the query based on whether projectId is provided
      let query = `
        SELECT id, user_id, project_id, name, description, columns, created_at, updated_at, is_active, version, previous_version_id
        FROM global_schemas
        WHERE user_id = '${userId}'
      `;

      // Add project filter if projectId is provided
      if (projectId) {
        query += ` AND project_id = '${projectId}'`;
      }

      // Add order by
      query += ` ORDER BY created_at DESC`;

      // Get schemas
      const result = (await executeQuery(query)) as Array<{
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
            `[GlobalSchemaService] Error parsing columns for schema ${schema.id}:`,
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
        `[GlobalSchemaService] Error getting schemas for user ${userId}${
          projectId ? ` and project ${projectId}` : ""
        }:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get schema templates
   * @returns Array of schema templates
   */
  getSchemaTemplates(): any[] {
    // Return predefined schema templates
    return [
      {
        id: "template_basic",
        name: "Basic Schema",
        description: "A simple schema with basic fields",
        columns: [
          {
            id: "col_id",
            name: "id",
            type: "string",
            description: "Unique identifier",
            isPrimaryKey: true,
            isRequired: true,
          },
          {
            id: "col_name",
            name: "name",
            type: "string",
            description: "Name",
            isRequired: true,
          },
          {
            id: "col_description",
            name: "description",
            type: "string",
            description: "Description",
          },
          {
            id: "col_created_at",
            name: "created_at",
            type: "timestamp",
            description: "Creation timestamp",
            isRequired: true,
          },
          {
            id: "col_updated_at",
            name: "updated_at",
            type: "timestamp",
            description: "Last update timestamp",
            isRequired: true,
          },
        ],
      },
      {
        id: "template_customer",
        name: "Customer Schema",
        description: "Schema for customer data",
        columns: [
          {
            id: "col_id",
            name: "id",
            type: "string",
            description: "Unique identifier",
            isPrimaryKey: true,
            isRequired: true,
          },
          {
            id: "col_first_name",
            name: "first_name",
            type: "string",
            description: "First name",
            isRequired: true,
          },
          {
            id: "col_last_name",
            name: "last_name",
            type: "string",
            description: "Last name",
            isRequired: true,
          },
          {
            id: "col_email",
            name: "email",
            type: "string",
            description: "Email address",
            isRequired: true,
          },
          {
            id: "col_phone",
            name: "phone",
            type: "string",
            description: "Phone number",
          },
          {
            id: "col_address",
            name: "address",
            type: "string",
            description: "Address",
          },
          {
            id: "col_created_at",
            name: "created_at",
            type: "timestamp",
            description: "Creation timestamp",
            isRequired: true,
          },
          {
            id: "col_updated_at",
            name: "updated_at",
            type: "timestamp",
            description: "Last update timestamp",
            isRequired: true,
          },
        ],
      },
      {
        id: "template_product",
        name: "Product Schema",
        description: "Schema for product data",
        columns: [
          {
            id: "col_id",
            name: "id",
            type: "string",
            description: "Unique identifier",
            isPrimaryKey: true,
            isRequired: true,
          },
          {
            id: "col_name",
            name: "name",
            type: "string",
            description: "Product name",
            isRequired: true,
          },
          {
            id: "col_description",
            name: "description",
            type: "string",
            description: "Product description",
          },
          {
            id: "col_price",
            name: "price",
            type: "decimal",
            description: "Product price",
            isRequired: true,
          },
          {
            id: "col_category",
            name: "category",
            type: "string",
            description: "Product category",
          },
          {
            id: "col_sku",
            name: "sku",
            type: "string",
            description: "Stock keeping unit",
            isRequired: true,
          },
          {
            id: "col_inventory",
            name: "inventory",
            type: "integer",
            description: "Current inventory level",
            isRequired: true,
          },
          {
            id: "col_created_at",
            name: "created_at",
            type: "timestamp",
            description: "Creation timestamp",
            isRequired: true,
          },
          {
            id: "col_updated_at",
            name: "updated_at",
            type: "timestamp",
            description: "Last update timestamp",
            isRequired: true,
          },
        ],
      },
    ];
  }

  /**
   * Validate a schema
   * @param schema Schema to validate
   * @returns Validation result
   */
  validateSchema(schema: GlobalSchema): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!schema.name) {
      errors.push("Schema name is required");
    }

    if (!schema.userId) {
      errors.push("User ID is required");
    }

    if (!schema.projectId) {
      errors.push("Project ID is required");
    }

    // Check columns
    if (!schema.columns || schema.columns.length === 0) {
      errors.push("Schema must have at least one column");
    } else {
      // Check for primary key
      const hasPrimaryKey = schema.columns.some(
        (column) => column.isPrimaryKey
      );
      if (!hasPrimaryKey) {
        errors.push("Schema must have at least one primary key column");
      }

      // Check column names
      const columnNames = new Set<string>();
      for (const column of schema.columns) {
        // Check required fields
        if (!column.name) {
          errors.push("Column name is required");
          continue;
        }

        if (!column.type) {
          errors.push(`Column type is required for column '${column.name}'`);
        }

        // Check for duplicate column names
        if (columnNames.has(column.name)) {
          errors.push(`Duplicate column name: ${column.name}`);
        } else {
          columnNames.add(column.name);
        }

        // Check column name format
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column.name)) {
          errors.push(
            `Invalid column name: ${column.name}. Column names must start with a letter or underscore and contain only letters, numbers, and underscores.`
          );
        }

        // Check column type
        const validTypes = [
          "string",
          "integer",
          "decimal",
          "boolean",
          "date",
          "timestamp",
          "json",
          "array",
        ];
        if (!validTypes.includes(column.type)) {
          errors.push(
            `Invalid column type: ${column.type} for column '${
              column.name
            }'. Valid types are: ${validTypes.join(", ")}`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

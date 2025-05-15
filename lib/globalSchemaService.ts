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
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            columns JSONB NOT NULL DEFAULT '[]',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            version INTEGER NOT NULL DEFAULT 1,
            previous_version_id TEXT
          )
        `);
      } else {
        // Check if the columns column exists
        const columnsExists = await this.checkIfColumnExists(
          "global_schemas",
          "columns"
        );

        if (!columnsExists) {
          // Add the columns column if it doesn't exist
          console.log("Adding columns column to global_schemas table");
          await executeQuery(`
            ALTER TABLE global_schemas
            ADD COLUMN columns JSONB NOT NULL DEFAULT '[]'
          `);
        }
      }

      // Generate schema ID
      const schemaId = `schema_${uuidv4()}`;

      // Add IDs to columns
      const columnsWithIds = columns.map((column) => ({
        ...column,
        id: `col_${uuidv4()}`,
      }));

      // Check if columns column exists again (just to be safe)
      const columnsExists = await this.checkIfColumnExists(
        "global_schemas",
        "columns"
      );

      if (columnsExists) {
        // Create schema with columns
        await executeQuery(`
          INSERT INTO global_schemas (
            id,
            project_id,
            name,
            description,
            columns,
            created_at,
            updated_at
          )
          VALUES (
            '${schemaId}',
            '${projectId}',
            '${name}',
            ${description ? `'${description}'` : "NULL"},
            '${JSON.stringify(columnsWithIds)}',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `);
      } else {
        // Create schema without columns
        console.log("Creating schema without columns column");
        await executeQuery(`
          INSERT INTO global_schemas (
            id,
            project_id,
            name,
            description,
            created_at,
            updated_at
          )
          VALUES (
            '${schemaId}',
            '${projectId}',
            '${name}',
            ${description ? `'${description}'` : "NULL"},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `);

        // Check if schema_columns table exists
        const schemaColumnsTableExists = await this.checkIfTableExists(
          "schema_columns"
        );

        if (!schemaColumnsTableExists) {
          // Create schema_columns table
          console.log("Creating schema_columns table");
          await executeQuery(`
            CREATE TABLE schema_columns (
              id TEXT PRIMARY KEY,
              global_schema_id TEXT NOT NULL,
              name TEXT NOT NULL,
              description TEXT,
              data_type TEXT NOT NULL,
              is_required BOOLEAN NOT NULL DEFAULT FALSE,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
          `);
        }

        // Create schema columns in the schema_columns table
        for (const column of columnsWithIds) {
          const columnId = column.id;
          await executeQuery(`
            INSERT INTO schema_columns (
              id,
              global_schema_id,
              name,
              description,
              data_type,
              is_required,
              created_at,
              updated_at
            )
            VALUES (
              '${columnId}',
              '${schemaId}',
              '${column.name}',
              ${column.description ? `'${column.description}'` : "NULL"},
              '${column.type}',
              ${column.isRequired ? "TRUE" : "FALSE"},
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
          `);
        }
      }

      // Columns are now stored as JSON in the columns field

      // Return created schema
      return {
        id: schemaId,
        userId, // Include userId for interface compatibility even though it's not in the database
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

      // Check if columns exist
      const columnsExists = await this.checkIfColumnExists(
        "global_schemas",
        "columns"
      );

      const isActiveExists = await this.checkIfColumnExists(
        "global_schemas",
        "is_active"
      );

      const versionExists = await this.checkIfColumnExists(
        "global_schemas",
        "version"
      );

      const previousVersionIdExists = await this.checkIfColumnExists(
        "global_schemas",
        "previous_version_id"
      );

      // Get schema
      const result = (await executeQuery(`
        SELECT id, project_id, name, description, ${
          columnsExists ? "columns," : ""
        } created_at, updated_at${isActiveExists ? ", is_active" : ""}${
        versionExists ? ", version" : ""
      }${previousVersionIdExists ? ", previous_version_id" : ""}
        FROM global_schemas
        WHERE id = '${schemaId}'
      `)) as Array<{
        id: string;
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
        } else {
          // If columns column doesn't exist, get columns from schema_columns table
          parsedColumns = await this.getSchemaColumnsForSchema(schema.id);
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
        userId: "unknown", // Default value since user_id is not in the database
        projectId: schema.project_id,
        name: schema.name,
        description: schema.description,
        columns: parsedColumns,
        createdAt: new Date(schema.created_at),
        updatedAt: new Date(schema.updated_at),
        isActive: schema.is_active !== undefined ? schema.is_active : true, // Default to true if column doesn't exist
        version: schema.version !== undefined ? schema.version : 1, // Default to 1 if column doesn't exist
        previousVersionId: schema.previous_version_id, // Will be undefined if column doesn't exist
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

      // Check if columns exist
      const columnsExists = await this.checkIfColumnExists(
        "global_schemas",
        "columns"
      );

      const isActiveExists = await this.checkIfColumnExists(
        "global_schemas",
        "is_active"
      );

      const versionExists = await this.checkIfColumnExists(
        "global_schemas",
        "version"
      );

      const previousVersionIdExists = await this.checkIfColumnExists(
        "global_schemas",
        "previous_version_id"
      );

      // Get schemas
      const result = (await executeQuery(`
        SELECT id, project_id, name, description, ${
          columnsExists ? "columns," : ""
        } created_at, updated_at${isActiveExists ? ", is_active" : ""}${
        versionExists ? ", version" : ""
      }${previousVersionIdExists ? ", previous_version_id" : ""}
        FROM global_schemas
        WHERE project_id = '${projectId}'
        ${activeOnly && isActiveExists ? "AND is_active = TRUE" : ""}
        ORDER BY created_at DESC
      `)) as Array<{
        id: string;
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

      // Process each schema and fetch columns if needed
      const schemas: GlobalSchema[] = [];

      for (const schema of result) {
        // Parse columns
        let parsedColumns: SchemaColumn[] = [];
        try {
          if (schema.columns) {
            if (typeof schema.columns === "string") {
              parsedColumns = JSON.parse(schema.columns);
            } else if (typeof schema.columns === "object") {
              parsedColumns = schema.columns as unknown as SchemaColumn[];
            }
          } else {
            // If columns column doesn't exist, get columns from schema_columns table
            parsedColumns = await this.getSchemaColumnsForSchema(schema.id);
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

        // Add schema to result array
        schemas.push({
          id: schema.id,
          userId: "unknown", // Default value since user_id is not in the database
          projectId: schema.project_id,
          name: schema.name,
          description: schema.description,
          columns: parsedColumns,
          createdAt: new Date(schema.created_at),
          updatedAt: new Date(schema.updated_at),
          isActive: schema.is_active !== undefined ? schema.is_active : true, // Default to true if column doesn't exist
          version: schema.version !== undefined ? schema.version : 1, // Default to 1 if column doesn't exist
          previousVersionId: schema.previous_version_id, // Will be undefined if column doesn't exist
        });
      }

      return schemas;
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

      // Check if columns exist
      const columnsExists = await this.checkIfColumnExists(
        "global_schemas",
        "columns"
      );

      const isActiveExists = await this.checkIfColumnExists(
        "global_schemas",
        "is_active"
      );

      const versionExists = await this.checkIfColumnExists(
        "global_schemas",
        "version"
      );

      const previousVersionIdExists = await this.checkIfColumnExists(
        "global_schemas",
        "previous_version_id"
      );

      // Build the update query
      let updateQuery = `
        UPDATE global_schemas
        SET
          name = '${schema.name}',
          description = ${
            schema.description ? `'${schema.description}'` : "NULL"
          },
          ${
            columnsExists
              ? `columns = '${JSON.stringify(columnsWithIds)}',`
              : ""
          }
          updated_at = CURRENT_TIMESTAMP
      `;

      // Add optional columns if they exist
      if (isActiveExists) {
        updateQuery += `, is_active = ${schema.isActive}`;
      }

      if (versionExists) {
        updateQuery += `, version = ${schema.version}`;
      }

      if (previousVersionIdExists) {
        updateQuery += `, previous_version_id = ${
          schema.previousVersionId ? `'${schema.previousVersionId}'` : "NULL"
        }`;
      }

      // Add WHERE clause
      updateQuery += ` WHERE id = '${schema.id}'`;

      // Execute the query
      await executeQuery(updateQuery);

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

      // Check if is_active column exists
      const isActiveExists = await this.checkIfColumnExists(
        "global_schemas",
        "is_active"
      );

      if (!isActiveExists) {
        // If is_active column doesn't exist, we can't set active schema
        return true; // Return success since this is optional functionality
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
   * Check if a column exists in a table
   * @param tableName Table name
   * @param columnName Column name
   * @returns Promise<boolean> True if the column exists
   */
  private async checkIfColumnExists(
    tableName: string,
    columnName: string
  ): Promise<boolean> {
    try {
      const result = (await executeQuery(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = '${tableName}' AND column_name = '${columnName}'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      return result && result.length > 0 && result[0].exists;
    } catch (error) {
      console.error(
        `[GlobalSchemaService] Error checking if column ${columnName} exists in table ${tableName}:`,
        error
      );
      return false;
    }
  }

  /**
   * Get schema columns for a schema
   * @param schemaId Schema ID
   * @returns Promise<SchemaColumn[]> Schema columns
   */
  private async getSchemaColumnsForSchema(
    schemaId: string
  ): Promise<SchemaColumn[]> {
    try {
      const result = await executeQuery(`
        SELECT id, name, description, data_type, is_required
        FROM schema_columns
        WHERE global_schema_id = '${schemaId}'
      `);

      if (result && Array.isArray(result) && result.length > 0) {
        return result.map((col: any) => ({
          id: col.id,
          name: col.name,
          type: col.data_type,
          description: col.description,
          isRequired: col.is_required,
        }));
      }

      return [];
    } catch (error) {
      console.error(
        `[GlobalSchemaService] Error getting schema columns for schema ${schemaId}:`,
        error
      );
      return [];
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

      // Check if the columns column exists
      const columnsExists = await this.checkIfColumnExists(
        "global_schemas",
        "columns"
      );

      // Build the query based on whether projectId is provided
      let query = `
        SELECT gs.id, gs.project_id, gs.name, gs.description, ${
          columnsExists ? "gs.columns," : ""
        } gs.created_at, gs.updated_at
        FROM global_schemas gs
        JOIN projects p ON gs.project_id = p.id
        WHERE p.user_id = '${userId}'
      `;

      // Add project filter if projectId is provided
      if (projectId) {
        query += ` AND gs.project_id = '${projectId}'`;
      }

      // Add order by
      query += ` ORDER BY gs.created_at DESC`;

      // Get schemas
      const result = (await executeQuery(query)) as Array<{
        id: string;
        project_id: string;
        name: string;
        description: string;
        created_at: string;
        updated_at: string;
      }>;

      if (!result || result.length === 0) {
        return [];
      }

      // Create schemas with empty columns arrays
      const schemas = result.map((schema) => ({
        id: schema.id,
        userId, // Use the userId parameter passed to the function
        projectId: schema.project_id,
        name: schema.name,
        description: schema.description,
        columns: [] as SchemaColumn[],
        createdAt: new Date(schema.created_at),
        updatedAt: new Date(schema.updated_at),
        isActive: true, // Default value since this field is required by the interface but not in the database
        version: 1, // Default value since this field is required by the interface but not in the database
        previousVersionId: undefined, // Default value since this field is required by the interface but not in the database
      }));

      // Fetch columns for each schema
      for (const schema of schemas) {
        try {
          // Query to get columns for this schema
          const columnsQuery = `
            SELECT id, name, description, data_type, is_required, created_at, updated_at
            FROM schema_columns
            WHERE global_schema_id = '${schema.id}'
          `;

          const columnsResult = (await executeQuery(columnsQuery)) as Array<{
            id: string;
            name: string;
            description: string;
            data_type: string;
            is_required: boolean;
            created_at: string;
            updated_at: string;
          }>;

          if (columnsResult && columnsResult.length > 0) {
            schema.columns = columnsResult.map((col) => ({
              id: col.id,
              name: col.name,
              type: col.data_type, // Map data_type to type as required by SchemaColumn interface
              description: col.description,
              isRequired: col.is_required,
              createdAt: new Date(col.created_at),
              updatedAt: new Date(col.updated_at),
            }));
          }
        } catch (columnsError) {
          console.error(
            `[GlobalSchemaService] Error fetching columns for schema ${schema.id}:`,
            columnsError
          );
        }
      }

      return schemas;
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

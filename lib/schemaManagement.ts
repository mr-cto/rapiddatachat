import { executeQuery } from "./database";
import { SchemaService } from "./nlToSql/schemaService";
import { ViewStateManager } from "./viewStateManager";

/**
 * Interface for a schema column
 */
export interface SchemaColumn {
  name: string;
  type: string;
  description?: string;
  sourceFile?: string;
  sourceColumn?: string;
  isRequired?: boolean;
}

/**
 * Interface for the global schema
 */
export interface GlobalSchema {
  id: string;
  userId: string;
  name: string;
  description?: string;
  columns: SchemaColumn[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * Interface for column mapping
 */
export interface ColumnMapping {
  fileId: string;
  schemaId: string;
  mappings: {
    fileColumn: string;
    schemaColumn: string;
    transformationRule?: string;
  }[];
}

/**
 * SchemaManagementService class for managing global schemas across files
 */
export class SchemaManagementService {
  private schemaService: SchemaService;

  constructor() {
    this.schemaService = new SchemaService();
  }

  /**
   * Create a global schema from all active files
   * @param userId User ID
   * @param name Schema name
   * @param description Schema description
   * @returns Promise<GlobalSchema> Created global schema
   */
  async createGlobalSchemaFromActiveFiles(
    userId: string,
    name: string,
    description?: string
  ): Promise<GlobalSchema> {
    try {
      console.log(
        `[SchemaManagementService] Creating global schema from active files for user: ${userId}`
      );

      // Get schema for all active tables
      console.log(
        `[DEBUG] About to call getSchemaForActiveTables for user: ${userId}`
      );

      // Use the user ID as provided - the schemaService will handle ID format differences
      const schema = await this.schemaService.getSchemaForActiveTables(userId);
      console.log(
        `[DEBUG] getSchemaForActiveTables returned schema with ${
          schema.tables ? schema.tables.length : 0
        } tables`
      );

      // Check if there are any active tables
      if (!schema.tables || schema.tables.length === 0) {
        console.log(`[DEBUG] No tables found in schema`);
        throw new Error(
          "No active tables found. Please upload and activate at least one file before creating a schema."
        );
      }

      // Extract unique columns from all tables
      const uniqueColumns = new Map<string, SchemaColumn>();

      for (const table of schema.tables) {
        // Get the actual columns from the data field
        const sampleData = await this.schemaService.getSampleData(
          table.name,
          1
        );
        let jsonFields: string[] = [];

        try {
          const sampleDataObj = JSON.parse(sampleData);
          if (
            sampleDataObj &&
            sampleDataObj.length > 0 &&
            sampleDataObj[0].data
          ) {
            jsonFields = Object.keys(sampleDataObj[0].data);
          }
        } catch (error) {
          console.error(
            `[SchemaManagementService] Error parsing sample data: ${error}`
          );
        }

        // Add each column to the unique columns map
        for (const field of jsonFields) {
          if (!uniqueColumns.has(field)) {
            uniqueColumns.set(field, {
              name: field,
              type: this.determineColumnType(field),
              sourceFile: table.name,
              sourceColumn: field,
            });
          }
        }
      }

      // Get the columns array
      const columnsArray = Array.from(uniqueColumns.values());

      // Check if we have at least one column
      if (columnsArray.length === 0) {
        throw new Error(
          "No columns found in active files. Please ensure your files contain valid data."
        );
      }

      // Create the global schema
      const schemaId = `schema_${Date.now()}`;
      const globalSchema: GlobalSchema = {
        id: schemaId,
        userId,
        name,
        description,
        columns: columnsArray,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      // Store the schema in the database
      await this.saveGlobalSchema(globalSchema);

      return globalSchema;
    } catch (error) {
      console.error(
        "[SchemaManagementService] Error creating global schema:",
        error
      );
      throw error;
    }
  }

  /**
   * Create a global schema with predefined columns
   * @param userId User ID
   * @param name Schema name
   * @param description Schema description
   * @param columns Schema columns
   * @returns Promise<GlobalSchema> Created global schema
   */
  async createGlobalSchemaWithColumns(
    userId: string,
    name: string,
    description?: string,
    columns: SchemaColumn[] = []
  ): Promise<GlobalSchema> {
    try {
      console.log(
        `[SchemaManagementService] Creating global schema with predefined columns for user: ${userId}`
      );

      // Validate that there is at least one column
      if (columns.length === 0) {
        throw new Error("Schema must have at least one column");
      }

      // Create the global schema
      const schemaId = `schema_${Date.now()}`;
      const globalSchema: GlobalSchema = {
        id: schemaId,
        userId,
        name,
        description,
        columns: columns,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      // Store the schema in the database
      await this.saveGlobalSchema(globalSchema);

      return globalSchema;
    } catch (error) {
      console.error(
        "[SchemaManagementService] Error creating global schema with columns:",
        error
      );
      throw error;
    }
  }

  /**
   * Save a global schema to the database
   * @param schema Global schema to save
   * @returns Promise<void>
   */
  private async saveGlobalSchema(schema: GlobalSchema): Promise<void> {
    try {
      // Check if the global_schemas table exists
      const tableExists = await this.checkIfTableExists("global_schemas");

      if (!tableExists) {
        // Create the table if it doesn't exist
        await executeQuery(`
          CREATE TABLE global_schemas (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            columns JSONB NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN NOT NULL DEFAULT TRUE
          )
        `);
      }

      // Insert or update the schema
      await executeQuery(`
        INSERT INTO global_schemas (id, user_id, name, description, columns, created_at, updated_at, is_active)
        VALUES (
          '${schema.id}',
          '${schema.userId}',
          '${schema.name}',
          ${schema.description ? `'${schema.description}'` : "NULL"},
          '${JSON.stringify(schema.columns)}',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          ${schema.isActive}
        )
        ON CONFLICT (id)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          columns = EXCLUDED.columns,
          updated_at = CURRENT_TIMESTAMP,
          is_active = EXCLUDED.is_active
      `);
    } catch (error) {
      console.error(
        "[SchemaManagementService] Error saving global schema:",
        error
      );
      throw error;
    }
  }

  /**
   * Get all global schemas for a user
   * @param userId User ID
   * @returns Promise<GlobalSchema[]> Global schemas
   */
  async getGlobalSchemas(userId: string): Promise<GlobalSchema[]> {
    try {
      // Check if the global_schemas table exists
      const tableExists = await this.checkIfTableExists("global_schemas");

      if (!tableExists) {
        return [];
      }

      // Get all schemas for the user
      const result = (await executeQuery(`
        SELECT id, user_id, name, description, columns, created_at, updated_at, is_active
        FROM global_schemas
        WHERE user_id = '${userId}'
        ORDER BY updated_at DESC
      `)) as Array<{
        id: string;
        user_id: string;
        name: string;
        description: string;
        columns: string;
        created_at: string;
        updated_at: string;
        is_active: boolean;
      }>;

      // Convert the result to GlobalSchema objects
      return (result || []).map((row) => {
        let parsedColumns = [];
        try {
          // Handle potential invalid JSON or empty strings
          if (row.columns) {
            if (typeof row.columns === "string") {
              // If it's a string, parse it
              if (row.columns.trim() !== "") {
                parsedColumns = JSON.parse(row.columns);
              }
            } else if (typeof row.columns === "object") {
              // If it's already an object, use it directly
              parsedColumns = row.columns;
            }
          }
        } catch (parseError) {
          console.error(
            `[SchemaManagementService] Error parsing columns for schema ${row.id}:`,
            parseError
          );
          // Use empty array as fallback
          parsedColumns = [];
        }

        return {
          id: row.id,
          userId: row.user_id,
          name: row.name,
          description: row.description,
          columns: parsedColumns,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          isActive: row.is_active,
        };
      });
    } catch (error) {
      console.error(
        "[SchemaManagementService] Error getting global schemas:",
        error
      );
      return [];
    }
  }

  /**
   * Get a global schema by ID
   * @param schemaId Schema ID
   * @returns Promise<GlobalSchema | null> Global schema or null if not found
   */
  async getGlobalSchemaById(schemaId: string): Promise<GlobalSchema | null> {
    try {
      // Check if the global_schemas table exists
      const tableExists = await this.checkIfTableExists("global_schemas");

      if (!tableExists) {
        return null;
      }

      // Get the schema
      const result = (await executeQuery(`
        SELECT id, user_id, name, description, columns, created_at, updated_at, is_active
        FROM global_schemas
        WHERE id = '${schemaId}'
      `)) as Array<{
        id: string;
        user_id: string;
        name: string;
        description: string;
        columns: string;
        created_at: string;
        updated_at: string;
        is_active: boolean;
      }>;

      if (!result || result.length === 0) {
        return null;
      }

      const row = result[0];

      // Convert to a GlobalSchema object
      // Parse columns with error handling
      let parsedColumns = [];
      try {
        // Handle potential invalid JSON or empty strings
        if (row.columns) {
          if (typeof row.columns === "string") {
            // If it's a string, parse it
            if (row.columns.trim() !== "") {
              parsedColumns = JSON.parse(row.columns);
            }
          } else if (typeof row.columns === "object") {
            // If it's already an object, use it directly
            parsedColumns = row.columns;
          }
        }
      } catch (parseError) {
        console.error(
          `[SchemaManagementService] Error parsing columns for schema ${row.id}:`,
          parseError
        );
        // Use empty array as fallback
        parsedColumns = [];
      }

      return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        columns: parsedColumns,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        isActive: row.is_active,
      };
    } catch (error) {
      console.error(
        `[SchemaManagementService] Error getting global schema ${schemaId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Update a global schema
   * @param schema Global schema to update
   * @returns Promise<GlobalSchema | null> Updated global schema or null if failed
   */
  async updateGlobalSchema(schema: GlobalSchema): Promise<GlobalSchema | null> {
    try {
      // Check if the schema exists
      const existingSchema = await this.getGlobalSchemaById(schema.id);

      if (!existingSchema) {
        return null;
      }

      // Update the schema
      schema.updatedAt = new Date();
      await this.saveGlobalSchema(schema);

      return schema;
    } catch (error) {
      console.error(
        `[SchemaManagementService] Error updating global schema ${schema.id}:`,
        error
      );
      return null;
    }
  }

  /**
   * Delete a global schema
   * @param schemaId Schema ID
   * @returns Promise<boolean> True if deleted successfully
   */
  async deleteGlobalSchema(schemaId: string): Promise<boolean> {
    try {
      console.log(
        `[SchemaManagementService] Attempting to delete global schema ${schemaId}`
      );

      // Check if the global_schemas table exists
      const tableExists = await this.checkIfTableExists("global_schemas");
      console.log(
        `[SchemaManagementService] global_schemas table exists: ${tableExists}`
      );

      if (!tableExists) {
        console.log(
          `[SchemaManagementService] Cannot delete schema: table does not exist`
        );
        return false;
      }

      // Check if the schema exists before deleting
      const existingSchema = await this.getGlobalSchemaById(schemaId);
      if (!existingSchema) {
        console.log(
          `[SchemaManagementService] Cannot delete schema: schema ${schemaId} not found`
        );
        return false;
      }

      console.log(
        `[SchemaManagementService] Found schema to delete: ${existingSchema.name}`
      );

      // Delete the schema
      console.log(
        `[SchemaManagementService] Executing DELETE query for schema ${schemaId}`
      );
      await executeQuery(`
        DELETE FROM global_schemas
        WHERE id = '${schemaId}'
      `);
      console.log(
        `[SchemaManagementService] DELETE query executed successfully`
      );

      return true;
    } catch (error) {
      console.error(
        `[SchemaManagementService] Error deleting global schema ${schemaId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Save column mappings for a file
   * @param mapping Column mapping to save
   * @returns Promise<boolean> True if saved successfully
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

      // Insert or update the mapping
      await executeQuery(`
        INSERT INTO column_mappings (file_id, schema_id, mappings, created_at, updated_at)
        VALUES (
          '${mapping.fileId}',
          '${mapping.schemaId}',
          '${JSON.stringify(mapping.mappings)}',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (file_id, schema_id)
        DO UPDATE SET
          mappings = EXCLUDED.mappings,
          updated_at = CURRENT_TIMESTAMP
      `);

      return true;
    } catch (error) {
      console.error(
        "[SchemaManagementService] Error saving column mapping:",
        error
      );
      return false;
    }
  }

  /**
   * Get column mappings for a file
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

      // Get the mapping
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

      const row = result[0];

      // Parse mappings with error handling
      let parsedMappings = [];
      try {
        // Handle potential invalid JSON or empty strings
        if (row.mappings) {
          if (typeof row.mappings === "string") {
            // If it's a string, parse it
            if (row.mappings.trim() !== "") {
              parsedMappings = JSON.parse(row.mappings);
            }
          } else if (typeof row.mappings === "object") {
            // If it's already an object, use it directly
            parsedMappings = row.mappings;
          }
        }
      } catch (parseError) {
        console.error(
          `[SchemaManagementService] Error parsing mappings for file ${fileId} and schema ${schemaId}:`,
          parseError
        );
        // Use empty array as fallback
        parsedMappings = [];
      }

      // Convert to a ColumnMapping object
      return {
        fileId: row.file_id,
        schemaId: row.schema_id,
        mappings: parsedMappings,
      };
    } catch (error) {
      console.error(
        `[SchemaManagementService] Error getting column mapping for file ${fileId} and schema ${schemaId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Apply a global schema to the view state manager
   * @param viewStateManager ViewStateManager instance
   * @param schema Global schema to apply
   * @returns Promise<boolean> True if applied successfully
   */
  async applySchemaToViewState(
    viewStateManager: ViewStateManager,
    schema: GlobalSchema
  ): Promise<boolean> {
    try {
      if (!viewStateManager) {
        return false;
      }

      // Set hidden columns based on the schema
      const viewState = viewStateManager.getViewState();
      const allColumns = this.getAllColumnsFromViewState(viewState);

      // Determine which columns to hide (those not in the schema)
      const schemaColumnNames = schema.columns.map((col) => col.name);
      const columnsToHide = allColumns.filter(
        (col) => !schemaColumnNames.includes(col)
      );

      // Update the view state
      viewStateManager.setHiddenColumns(columnsToHide);

      return true;
    } catch (error) {
      console.error(
        "[SchemaManagementService] Error applying schema to view state:",
        error
      );
      return false;
    }
  }

  /**
   * Get all columns from a view state
   * @param viewState View state
   * @returns string[] All column names
   */
  private getAllColumnsFromViewState(viewState: any): string[] {
    const columns = new Set<string>();

    // Add virtual columns
    if (viewState.virtualColumns) {
      viewState.virtualColumns.forEach((vc: any) => {
        columns.add(vc.name);
      });
    }

    // Add merged columns
    if (viewState.columnMerges) {
      viewState.columnMerges.forEach((cm: any) => {
        columns.add(cm.name);
        cm.columns.forEach((col: string) => {
          columns.add(col);
        });
      });
    }

    // Add columns from filters
    if (viewState.filters) {
      viewState.filters.forEach((filter: any) => {
        columns.add(filter.column);
      });
    }

    // Add columns from sort config
    if (viewState.sortConfig) {
      viewState.sortConfig.forEach((sort: any) => {
        columns.add(sort.column);
      });
    }

    return Array.from(columns);
  }

  /**
   * Check if a table exists
   * @param tableName Table name
   * @returns Promise<boolean> True if the table exists
   */
  private async checkIfTableExists(tableName: string): Promise<boolean> {
    try {
      console.log(
        `[SchemaManagementService] Checking if table ${tableName} exists`
      );

      const result = (await executeQuery(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = '${tableName}'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      const exists = result && result.length > 0 && result[0].exists;
      console.log(
        `[SchemaManagementService] Table ${tableName} exists: ${exists}`
      );

      return exists;
    } catch (error) {
      console.error(
        `[SchemaManagementService] Error checking if table ${tableName} exists:`,
        error
      );
      return false;
    }
  }

  /**
   * Determine the column type based on the column name
   * @param columnName Column name
   * @returns string Column type
   */
  private determineColumnType(columnName: string): string {
    const lowerName = columnName.toLowerCase();

    if (lowerName.includes("date") || lowerName.includes("time")) {
      return "timestamp";
    } else if (
      lowerName.includes("price") ||
      lowerName.includes("cost") ||
      lowerName.includes("amount")
    ) {
      return "numeric";
    } else if (
      lowerName.includes("count") ||
      lowerName.includes("number") ||
      lowerName.includes("qty") ||
      lowerName.includes("quantity")
    ) {
      return "integer";
    } else if (lowerName.includes("is_") || lowerName.includes("has_")) {
      return "boolean";
    } else {
      return "text";
    }
  }
}

import { executeQuery } from "./database";
import { v4 as uuidv4 } from "uuid";

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
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  referencesTable?: string;
  referencesColumn?: string;
  defaultValue?: string;
  validationRules?: ValidationRule[];
}

/**
 * Interface for a validation rule
 */
export interface ValidationRule {
  type: "min" | "max" | "pattern" | "enum" | "custom";
  value: any;
  errorMessage?: string;
}

/**
 * Interface for the global schema
 */
export interface GlobalSchema {
  id: string;
  userId: string;
  projectId?: string;
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
  mappings: {
    fileColumn: string;
    schemaColumn: string;
    transformationRule?: string;
  }[];
}

/**
 * Interface for schema template
 */
export interface SchemaTemplate {
  name: string;
  description: string;
  columns: SchemaColumn[];
}

/**
 * Interface for schema validation result
 */
export interface SchemaValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * GlobalSchemaService class for managing global schemas across files
 */
export class GlobalSchemaService {
  private schemaTemplates: SchemaTemplate[] = [
    {
      name: "Empty Schema",
      description: "An empty schema with no predefined columns",
      columns: [],
    },
    {
      name: "User Data",
      description: "A schema for user data with common user fields",
      columns: [
        {
          name: "id",
          type: "text",
          description: "Unique identifier for the user",
          isRequired: true,
          isPrimaryKey: true,
        },
        {
          name: "email",
          type: "text",
          description: "User's email address",
          isRequired: true,
          validationRules: [
            {
              type: "pattern",
              value: "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$",
              errorMessage: "Invalid email format",
            },
          ],
        },
        {
          name: "name",
          type: "text",
          description: "User's full name",
          isRequired: true,
        },
        {
          name: "created_at",
          type: "timestamp",
          description: "When the user was created",
          isRequired: true,
          defaultValue: "CURRENT_TIMESTAMP",
        },
      ],
    },
    {
      name: "Product Catalog",
      description: "A schema for product catalog data",
      columns: [
        {
          name: "product_id",
          type: "text",
          description: "Unique identifier for the product",
          isRequired: true,
          isPrimaryKey: true,
        },
        {
          name: "name",
          type: "text",
          description: "Product name",
          isRequired: true,
        },
        {
          name: "description",
          type: "text",
          description: "Product description",
        },
        {
          name: "price",
          type: "numeric",
          description: "Product price",
          isRequired: true,
          validationRules: [
            {
              type: "min",
              value: 0,
              errorMessage: "Price must be greater than or equal to 0",
            },
          ],
        },
        {
          name: "category",
          type: "text",
          description: "Product category",
        },
        {
          name: "created_at",
          type: "timestamp",
          description: "When the product was created",
          isRequired: true,
          defaultValue: "CURRENT_TIMESTAMP",
        },
      ],
    },
  ];

  /**
   * Get available schema templates
   * @returns SchemaTemplate[] Array of schema templates
   */
  getSchemaTemplates(): SchemaTemplate[] {
    return this.schemaTemplates;
  }

  /**
   * Create a global schema from a template
   * @param userId User ID
   * @param projectId Project ID
   * @param templateName Template name
   * @param schemaName Schema name
   * @param schemaDescription Schema description
   * @returns Promise<GlobalSchema> Created global schema
   */
  async createSchemaFromTemplate(
    userId: string,
    projectId: string,
    templateName: string,
    schemaName: string,
    schemaDescription?: string
  ): Promise<GlobalSchema> {
    try {
      // Find the template
      const template = this.schemaTemplates.find(
        (t) => t.name === templateName
      );

      if (!template) {
        throw new Error(`Template '${templateName}' not found`);
      }

      // Create the global schema
      const schema: GlobalSchema = {
        id: `schema_${uuidv4()}`,
        userId,
        projectId,
        name: schemaName,
        description: schemaDescription,
        columns: template.columns,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        version: 1,
      };

      // Validate the schema
      const validationResult = this.validateSchema(schema);
      if (!validationResult.isValid) {
        throw new Error(
          `Invalid schema: ${validationResult.errors.join(", ")}`
        );
      }

      // Store the schema in the database
      await this.saveGlobalSchema(schema);

      return schema;
    } catch (error) {
      console.error(
        "[GlobalSchemaService] Error creating schema from template:",
        error
      );
      throw error;
    }
  }

  /**
   * Create a global schema with predefined columns
   * @param userId User ID
   * @param projectId Project ID
   * @param name Schema name
   * @param description Schema description
   * @param columns Schema columns
   * @returns Promise<GlobalSchema> Created global schema
   */
  async createGlobalSchema(
    userId: string,
    projectId: string,
    name: string,
    description?: string,
    columns: SchemaColumn[] = []
  ): Promise<GlobalSchema> {
    try {
      console.log(
        `[GlobalSchemaService] Creating global schema with predefined columns for user: ${userId}`
      );

      // Validate that there is at least one column
      if (columns.length === 0) {
        throw new Error("Schema must have at least one column");
      }

      // Create the global schema
      const schema: GlobalSchema = {
        id: `schema_${uuidv4()}`,
        userId,
        projectId,
        name,
        description,
        columns,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        version: 1,
      };

      // Validate the schema
      const validationResult = this.validateSchema(schema);
      if (!validationResult.isValid) {
        throw new Error(
          `Invalid schema: ${validationResult.errors.join(", ")}`
        );
      }

      // Store the schema in the database
      await this.saveGlobalSchema(schema);

      return schema;
    } catch (error) {
      console.error(
        "[GlobalSchemaService] Error creating global schema with columns:",
        error
      );
      throw error;
    }
  }

  /**
   * Validate a global schema
   * @param schema Global schema to validate
   * @returns SchemaValidationResult Validation result
   */
  validateSchema(schema: GlobalSchema): SchemaValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!schema.name) {
      errors.push("Schema name is required");
    }

    if (!schema.userId) {
      errors.push("User ID is required");
    }

    if (!schema.columns || !Array.isArray(schema.columns)) {
      errors.push("Columns must be an array");
    } else if (schema.columns.length === 0) {
      warnings.push("Schema has no columns");
    } else {
      // Check for duplicate column names
      const columnNames = new Set<string>();
      for (const column of schema.columns) {
        if (!column.name) {
          errors.push("Column name is required");
        } else if (columnNames.has(column.name.toLowerCase())) {
          errors.push(`Duplicate column name: ${column.name}`);
        } else {
          columnNames.add(column.name.toLowerCase());
        }

        // Check column type
        if (!column.type) {
          errors.push(`Column type is required for column: ${column.name}`);
        } else if (
          !["text", "integer", "numeric", "boolean", "timestamp"].includes(
            column.type.toLowerCase()
          )
        ) {
          errors.push(
            `Invalid column type: ${column.type} for column: ${column.name}`
          );
        }

        // Check validation rules
        if (column.validationRules && Array.isArray(column.validationRules)) {
          for (const rule of column.validationRules) {
            if (!rule.type) {
              errors.push(
                `Validation rule type is required for column: ${column.name}`
              );
            } else if (
              !["min", "max", "pattern", "enum", "custom"].includes(rule.type)
            ) {
              errors.push(
                `Invalid validation rule type: ${rule.type} for column: ${column.name}`
              );
            }

            if (rule.value === undefined || rule.value === null) {
              errors.push(
                `Validation rule value is required for column: ${column.name}`
              );
            }
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
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
            project_id TEXT,
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

      // Insert or update the schema
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
          version,
          previous_version_id
        )
        VALUES (
          '${schema.id}',
          '${schema.userId}',
          ${schema.projectId ? `'${schema.projectId}'` : "NULL"},
          '${schema.name}',
          ${schema.description ? `'${schema.description}'` : "NULL"},
          '${JSON.stringify(schema.columns)}',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          ${schema.isActive},
          ${schema.version},
          ${schema.previousVersionId ? `'${schema.previousVersionId}'` : "NULL"}
        )
        ON CONFLICT (id)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          columns = EXCLUDED.columns,
          updated_at = CURRENT_TIMESTAMP,
          is_active = EXCLUDED.is_active,
          version = EXCLUDED.version,
          previous_version_id = EXCLUDED.previous_version_id
      `);
    } catch (error) {
      console.error("[GlobalSchemaService] Error saving global schema:", error);
      throw error;
    }
  }

  /**
   * Get all global schemas for a user
   * @param userId User ID
   * @param projectId Optional project ID to filter by
   * @returns Promise<GlobalSchema[]> Global schemas
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

      // Get all schemas for the user
      const query = `
        SELECT id, user_id, project_id, name, description, columns, created_at, updated_at, is_active, version, previous_version_id
        FROM global_schemas
        WHERE user_id = '${userId}'
        ${projectId ? `AND project_id = '${projectId}'` : ""}
        ORDER BY updated_at DESC
      `;

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
            `[GlobalSchemaService] Error parsing columns for schema ${row.id}:`,
            parseError
          );
          // Use empty array as fallback
          parsedColumns = [];
        }

        return {
          id: row.id,
          userId: row.user_id,
          projectId: row.project_id,
          name: row.name,
          description: row.description,
          columns: parsedColumns,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          isActive: row.is_active,
          version: row.version,
          previousVersionId: row.previous_version_id,
        };
      });
    } catch (error) {
      console.error(
        "[GlobalSchemaService] Error getting global schemas:",
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
          `[GlobalSchemaService] Error parsing columns for schema ${row.id}:`,
          parseError
        );
        // Use empty array as fallback
        parsedColumns = [];
      }

      return {
        id: row.id,
        userId: row.user_id,
        projectId: row.project_id,
        name: row.name,
        description: row.description,
        columns: parsedColumns,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        isActive: row.is_active,
        version: row.version,
        previousVersionId: row.previous_version_id,
      };
    } catch (error) {
      console.error(
        `[GlobalSchemaService] Error getting global schema ${schemaId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Update a global schema
   * @param schema Global schema to update
   * @param createNewVersion Whether to create a new version
   * @returns Promise<GlobalSchema | null> Updated global schema or null if failed
   */
  async updateGlobalSchema(
    schema: GlobalSchema,
    createNewVersion: boolean = false
  ): Promise<GlobalSchema | null> {
    try {
      // Check if the schema exists
      const existingSchema = await this.getGlobalSchemaById(schema.id);

      if (!existingSchema) {
        return null;
      }

      // Validate the schema
      const validationResult = this.validateSchema(schema);
      if (!validationResult.isValid) {
        throw new Error(
          `Invalid schema: ${validationResult.errors.join(", ")}`
        );
      }

      if (createNewVersion) {
        // Create a new version of the schema
        const newSchema: GlobalSchema = {
          id: `schema_${uuidv4()}`,
          userId: schema.userId,
          projectId: schema.projectId,
          name: schema.name,
          description: schema.description,
          columns: schema.columns,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: schema.isActive,
          version: existingSchema.version + 1,
          previousVersionId: existingSchema.id,
        };

        // Save the new version
        await this.saveGlobalSchema(newSchema);

        return newSchema;
      } else {
        // Update the existing schema
        schema.updatedAt = new Date();
        await this.saveGlobalSchema(schema);

        return schema;
      }
    } catch (error) {
      console.error(
        `[GlobalSchemaService] Error updating global schema ${schema.id}:`,
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
        `[GlobalSchemaService] Attempting to delete global schema ${schemaId}`
      );

      // Check if the global_schemas table exists
      const tableExists = await this.checkIfTableExists("global_schemas");
      console.log(
        `[GlobalSchemaService] global_schemas table exists: ${tableExists}`
      );

      if (!tableExists) {
        console.log(
          `[GlobalSchemaService] Cannot delete schema: table does not exist`
        );
        return false;
      }

      // Check if the schema exists before deleting
      const existingSchema = await this.getGlobalSchemaById(schemaId);
      if (!existingSchema) {
        console.log(
          `[GlobalSchemaService] Cannot delete schema: schema ${schemaId} not found`
        );
        return false;
      }

      console.log(
        `[GlobalSchemaService] Found schema to delete: ${existingSchema.name}`
      );

      // Delete the schema
      console.log(
        `[GlobalSchemaService] Executing DELETE query for schema ${schemaId}`
      );
      await executeQuery(`
        DELETE FROM global_schemas
        WHERE id = '${schemaId}'
      `);
      console.log(`[GlobalSchemaService] DELETE query executed successfully`);

      return true;
    } catch (error) {
      console.error(
        `[GlobalSchemaService] Error deleting global schema ${schemaId}:`,
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
        "[GlobalSchemaService] Error saving column mapping:",
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
          `[GlobalSchemaService] Error parsing mappings for file ${fileId} and schema ${schemaId}:`,
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
        `[GlobalSchemaService] Error getting column mapping for file ${fileId} and schema ${schemaId}:`,
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
      console.log(
        `[GlobalSchemaService] Checking if table ${tableName} exists`
      );

      const result = (await executeQuery(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = '${tableName}'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      const exists = result && result.length > 0 && result[0].exists;
      console.log(`[GlobalSchemaService] Table ${tableName} exists: ${exists}`);

      return exists;
    } catch (error) {
      console.error(
        `[GlobalSchemaService] Error checking if table ${tableName} exists:`,
        error
      );
      return false;
    }
  }
}

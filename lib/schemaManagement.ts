import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
  newColumnsAdded?: number;
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
      // Use Prisma to find column mappings
      const columnMappings = await prisma.columnMapping.findMany({
        where: {
          fileId: fileId,
          globalSchemaId: schemaId,
        },
        include: {
          schemaColumn: true,
        },
      });

      if (!columnMappings || columnMappings.length === 0) {
        return null;
      }

      // Convert Prisma model to our interface format
      const mappings: Record<string, string> = {};

      // Each mapping maps a file column to a schema column
      columnMappings.forEach((mapping) => {
        mappings[mapping.fileColumn] = mapping.schemaColumn.name;
      });

      return {
        fileId,
        schemaId,
        mappings,
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
      console.log(
        `[saveColumnMapping] Saving mapping for schema ${mapping.schemaId}`
      );

      // First, get the schema columns for this schema
      const schema = await prisma.globalSchema.findUnique({
        where: { id: mapping.schemaId },
        include: { columns: true },
      });

      if (!schema) {
        console.error(
          `[saveColumnMapping] Schema ${mapping.schemaId} not found`
        );
        throw new Error(`Schema ${mapping.schemaId} not found`);
      }

      // Log schema columns for debugging
      console.log(
        "[saveColumnMapping] Schema columns:",
        schema.columns.map((col) => ({ id: col.id, name: col.name }))
      );
      console.log("[saveColumnMapping] Mappings:", mapping.mappings);

      // Try to directly query the schema columns
      const directColumns = await prisma.schemaColumn.findMany({
        where: { globalSchemaId: mapping.schemaId },
      });

      console.log(
        "[saveColumnMapping] Direct schema columns query result:",
        directColumns.map((col) => ({ id: col.id, name: col.name }))
      );

      // Delete existing mappings for this file and schema
      await prisma.columnMapping.deleteMany({
        where: {
          fileId: mapping.fileId,
          globalSchemaId: mapping.schemaId,
        },
      });

      // Create new mappings
      const mappingEntries = Object.entries(mapping.mappings);

      // Normalize column names for comparison (remove spaces, special chars, lowercase)
      const normalizeColumnName = (name: string): string => {
        return name.toLowerCase().replace(/[^a-z0-9]/gi, "");
      };

      // Create a map of normalized column names to schema columns for faster lookup
      const normalizedColumnMap = new Map<string, any>();
      schema.columns.forEach((col) => {
        normalizedColumnMap.set(normalizeColumnName(col.name), col);
      });

      // For each file column to schema column mapping
      for (const [fileColumn, schemaColumnName] of mappingEntries) {
        // Log the current mapping for debugging
        console.log(
          `Mapping file column "${fileColumn}" to schema column "${schemaColumnName}"`
        );

        const normalizedSchemaColumnName =
          normalizeColumnName(schemaColumnName);

        // Find the schema column by name with normalized comparison
        const schemaColumn = normalizedColumnMap.get(
          normalizedSchemaColumnName
        );

        if (schemaColumn) {
          console.log(`Found matching schema column: ${schemaColumn.name}`);

          try {
            // Create the mapping
            await prisma.columnMapping.create({
              data: {
                fileId: mapping.fileId,
                globalSchemaId: mapping.schemaId,
                schemaColumnId: schemaColumn.id,
                fileColumn: fileColumn,
              },
            });
          } catch (error) {
            // Check if this is a unique constraint violation
            if (
              error instanceof Error &&
              error.message.includes("Unique constraint failed")
            ) {
              console.log(
                `Mapping already exists for file column ${fileColumn} and schema column ${schemaColumn.name}, skipping`
              );
              // Continue with the next mapping instead of failing
              continue;
            } else {
              // For other errors, rethrow
              throw error;
            }
          }
        } else {
          console.warn(
            `Schema column ${schemaColumnName} not found in schema ${mapping.schemaId}`
          );

          // Create the schema column if it doesn't exist
          console.log(
            `[saveColumnMapping] Creating missing schema column: ${schemaColumnName}`
          );
          try {
            const columnId = `col_${uuidv4()}`;
            const newSchemaColumn = await prisma.schemaColumn.create({
              data: {
                id: columnId,
                globalSchemaId: mapping.schemaId,
                name: schemaColumnName,
                description: null,
                dataType: "text", // Default to text type
                isRequired: false,
              },
            });

            console.log(
              `[saveColumnMapping] Created new schema column: ${newSchemaColumn.name} with ID ${columnId}`
            );

            // Create the mapping with the new schema column
            await prisma.columnMapping.create({
              data: {
                fileId: mapping.fileId,
                globalSchemaId: mapping.schemaId,
                schemaColumnId: columnId,
                fileColumn: fileColumn,
              },
            });

            console.log(
              `[saveColumnMapping] Created mapping for new schema column`
            );
          } catch (createError) {
            console.error(
              `[saveColumnMapping] Error creating schema column ${schemaColumnName}:`,
              createError
            );
          }
        }
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
      console.log(
        `[createGlobalSchema] Creating schema with ${columns.length} columns`
      );

      // Generate schema ID
      const schemaId = `schema_${uuidv4()}`;
      console.log(`[createGlobalSchema] Generated schema ID: ${schemaId}`);

      // Create the global schema using Prisma
      // Create the global schema using Prisma
      const globalSchema = await prisma.globalSchema.create({
        data: {
          id: schemaId,
          // Note: In the Prisma schema, fields use camelCase but are mapped to snake_case in DB
          // The userId field might not be in the Prisma schema, so we'll handle it differently
          projectId: projectId,
          name: name,
          description: description || null,
        },
      });

      console.log(`[createGlobalSchema] Created global schema:`, globalSchema);

      // Log input columns for debugging
      console.log(
        "Creating schema columns from:",
        columns.map((col) => ({ name: col.name, type: col.type }))
      );

      // Create schema columns
      const schemaColumns = [];
      console.log(
        `[createGlobalSchema] Creating ${columns.length} schema columns`
      );

      try {
        for (const column of columns) {
          const columnId = `col_${uuidv4()}`;
          console.log(
            `[createGlobalSchema] Creating schema column: ${column.name} (${column.type})`
          );

          try {
            const schemaColumn = await prisma.schemaColumn.create({
              data: {
                id: columnId,
                globalSchemaId: schemaId,
                name: column.name,
                description: column.description || null,
                dataType: column.type,
                isRequired: column.isRequired || false,
              },
            });

            console.log(
              `[createGlobalSchema] Created schema column with ID ${columnId}: ${schemaColumn.name}`
            );

            schemaColumns.push({
              id: columnId,
              name: column.name,
              type: column.type,
              description: column.description,
              isRequired: column.isRequired || false,
              isPrimaryKey: column.isPrimaryKey || false,
              defaultValue: column.defaultValue,
              derivationFormula: column.derivationFormula,
              isNewColumn: column.isNewColumn,
            });
          } catch (columnError) {
            console.error(
              `[createGlobalSchema] Error creating column ${column.name}:`,
              columnError
            );
          }
        }
      } catch (columnsError) {
        console.error(
          `[createGlobalSchema] Error creating schema columns:`,
          columnsError
        );
      }

      console.log(
        `[createGlobalSchema] Created ${schemaColumns.length} schema columns`
      );

      // Verify the schema was created with columns by querying it directly
      const createdSchema = await prisma.globalSchema.findUnique({
        where: { id: schemaId },
        include: { columns: true },
      });

      console.log(
        `[createGlobalSchema] Verifying created schema:`,
        createdSchema
          ? `Found with ${createdSchema.columns.length} columns`
          : "Not found"
      );

      // Return created schema
      return {
        id: schemaId,
        userId,
        projectId,
        name,
        description,
        columns: schemaColumns,
        createdAt: globalSchema.createdAt,
        updatedAt: globalSchema.updatedAt,
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
      console.log(`[getGlobalSchemaById] Getting schema with ID: ${schemaId}`);

      // Use Prisma to get the schema with its columns
      const schema = await prisma.globalSchema.findUnique({
        where: { id: schemaId },
        include: { columns: true },
      });

      console.log(`[getGlobalSchemaById] Schema found:`, schema ? "yes" : "no");

      if (!schema) {
        return null;
      }

      console.log(`[getGlobalSchemaById] Schema columns:`, schema.columns);

      // Convert Prisma model to our interface format
      const schemaColumns: SchemaColumn[] = schema.columns.map((column) => ({
        id: column.id,
        name: column.name,
        type: column.dataType,
        description: column.description || undefined,
        isRequired: column.isRequired || false,
        isPrimaryKey: false, // Default value as it's not in the Prisma schema
        defaultValue: undefined, // Default value as it's not in the Prisma schema
        derivationFormula: undefined, // Default value as it's not in the Prisma schema
        isNewColumn: false, // Default value as it's not in the Prisma schema
      }));

      console.log(
        `[getGlobalSchemaById] Converted schema columns:`,
        schemaColumns
      );

      // Return schema with default values for missing fields
      return {
        id: schema.id,
        userId: "unknown", // This field might not be in the Prisma schema
        projectId: schema.projectId,
        name: schema.name,
        description: schema.description || undefined,
        columns: schemaColumns,
        createdAt: schema.createdAt,
        updatedAt: schema.updatedAt,
        isActive: true, // Default value as it's not in the Prisma schema
        version: 1, // Default value as it's not in the Prisma schema
        previousVersionId: undefined, // Default value as it's not in the Prisma schema
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
      console.log(
        `[getGlobalSchemasForProject] Getting schemas for project: ${projectId}`
      );

      // Use Prisma to get all schemas
      // If projectId is empty string, get all schemas regardless of projectId
      const schemas = await prisma.globalSchema.findMany({
        where: projectId
          ? {
              projectId: projectId,
            }
          : {},
        include: {
          columns: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      console.log(
        `[getGlobalSchemasForProject] Found ${schemas.length} schemas`
      );

      if (!schemas || schemas.length === 0) {
        console.log(
          `[getGlobalSchemasForProject] No schemas found for project ${projectId}`
        );
        return [];
      }

      // Convert Prisma models to our interface format
      return schemas.map((schema) => {
        // Convert schema columns
        const schemaColumns: SchemaColumn[] = schema.columns.map((column) => ({
          id: column.id,
          name: column.name,
          type: column.dataType,
          description: column.description || undefined,
          isRequired: column.isRequired || false,
          isPrimaryKey: false, // Default value as it's not in the Prisma schema
          defaultValue: undefined, // Default value as it's not in the Prisma schema
          derivationFormula: undefined, // Default value as it's not in the Prisma schema
          isNewColumn: false, // Default value as it's not in the Prisma schema
        }));

        // Return schema with default values for missing fields
        return {
          id: schema.id,
          userId: "unknown", // This field might not be in the Prisma schema
          projectId: schema.projectId,
          name: schema.name,
          description: schema.description || undefined,
          columns: schemaColumns,
          createdAt: schema.createdAt,
          updatedAt: schema.updatedAt,
          isActive: true, // Default value as it's not in the Prisma schema
          version: 1, // Default value as it's not in the Prisma schema
          previousVersionId: undefined, // Default value as it's not in the Prisma schema
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
      console.log(`[updateGlobalSchema] Updating schema ${schema.id}`);

      // Ensure all columns have IDs
      const columnsWithIds = schema.columns.map((column) => ({
        ...column,
        id: column.id || `col_${uuidv4()}`,
      }));

      // Update the global schema using Prisma
      const updatedSchema = await prisma.globalSchema.update({
        where: { id: schema.id },
        data: {
          name: schema.name,
          description: schema.description || null,
        },
      });

      // Use a transaction to ensure all related records are deleted and created properly
      return await prisma.$transaction(async (tx) => {
        // First, find all column mappings for this schema
        const columnMappings = await tx.columnMapping.findMany({
          where: { globalSchemaId: schema.id },
        });

        console.log(
          `[updateGlobalSchema] Found ${columnMappings.length} column mappings to delete`
        );

        // Delete all column mappings
        if (columnMappings.length > 0) {
          await tx.columnMapping.deleteMany({
            where: { globalSchemaId: schema.id },
          });
          console.log(
            `[updateGlobalSchema] Deleted ${columnMappings.length} column mappings`
          );
        }

        // Now it's safe to delete schema columns
        const schemaColumns = await tx.schemaColumn.findMany({
          where: { globalSchemaId: schema.id },
        });

        console.log(
          `[updateGlobalSchema] Found ${schemaColumns.length} schema columns to delete`
        );

        // Delete all schema columns
        if (schemaColumns.length > 0) {
          await tx.schemaColumn.deleteMany({
            where: { globalSchemaId: schema.id },
          });
          console.log(
            `[updateGlobalSchema] Deleted ${schemaColumns.length} schema columns`
          );
        }

        // Create new schema columns
        const newSchemaColumns = [];
        for (const column of columnsWithIds) {
          const schemaColumn = await tx.schemaColumn.create({
            data: {
              id: column.id,
              globalSchemaId: schema.id,
              name: column.name,
              description: column.description || null,
              dataType: column.type,
              isRequired: column.isRequired || false,
            },
          });
          newSchemaColumns.push({
            id: column.id,
            name: column.name,
            type: column.type,
            description: column.description,
            isRequired: column.isRequired || false,
            isPrimaryKey: column.isPrimaryKey || false,
            defaultValue: column.defaultValue,
            derivationFormula: column.derivationFormula,
            isNewColumn: column.isNewColumn,
          });
        }

        console.log(
          `[updateGlobalSchema] Created ${newSchemaColumns.length} new schema columns`
        );

        return {
          ...schema,
          columns: newSchemaColumns,
          updatedAt: updatedSchema.updatedAt,
        };
      });
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
      console.log(`[deleteGlobalSchema] Deleting schema ${schemaId}`);

      // Use a transaction to ensure all related records are deleted
      return await prisma.$transaction(async (tx) => {
        // First, find all column mappings for this schema
        const columnMappings = await tx.columnMapping.findMany({
          where: { globalSchemaId: schemaId },
        });

        console.log(
          `[deleteGlobalSchema] Found ${columnMappings.length} column mappings to delete`
        );

        // Delete all column mappings
        if (columnMappings.length > 0) {
          await tx.columnMapping.deleteMany({
            where: { globalSchemaId: schemaId },
          });
          console.log(
            `[deleteGlobalSchema] Deleted ${columnMappings.length} column mappings`
          );
        }

        // Find all schema columns
        const schemaColumns = await tx.schemaColumn.findMany({
          where: { globalSchemaId: schemaId },
        });

        console.log(
          `[deleteGlobalSchema] Found ${schemaColumns.length} schema columns to delete`
        );

        // Delete all schema columns
        if (schemaColumns.length > 0) {
          await tx.schemaColumn.deleteMany({
            where: { globalSchemaId: schemaId },
          });
          console.log(
            `[deleteGlobalSchema] Deleted ${schemaColumns.length} schema columns`
          );
        }

        // Finally, delete the schema itself
        await tx.globalSchema.delete({
          where: { id: schemaId },
        });

        console.log(
          `[deleteGlobalSchema] Successfully deleted schema ${schemaId}`
        );

        return true;
      });
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
      console.log(
        `[setActiveSchema] Setting schema ${schemaId} as active for project ${projectId}`
      );

      // Check if schema exists
      const schema = await prisma.globalSchema.findUnique({
        where: { id: schemaId },
      });

      if (!schema) {
        console.error(`[setActiveSchema] Schema ${schemaId} not found`);
        return false;
      }

      // We'll use a custom query approach since the Prisma schema might not have the isActive field
      try {
        // Check if the is_active column exists
        const columnExists = await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'global_schemas' AND column_name = 'is_active'
          ) as exists
        `;

        const isActiveColumnExists = (columnExists as any)[0]?.exists || false;

        if (isActiveColumnExists) {
          // First, set all schemas for this project to inactive using a raw query
          await prisma.$executeRaw`
            UPDATE global_schemas
            SET is_active = false
            WHERE project_id = ${projectId}
            AND id != ${schemaId}
          `;

          console.log(
            `[setActiveSchema] Set all other schemas for project ${projectId} to inactive`
          );

          // Then set this schema to active
          await prisma.$executeRaw`
            UPDATE global_schemas
            SET is_active = true
            WHERE id = ${schemaId}
          `;

          console.log(
            `[setActiveSchema] Successfully set schema ${schemaId} as active`
          );
        } else {
          console.log(
            `[setActiveSchema] is_active column doesn't exist in global_schemas table, skipping active status update`
          );
        }
      } catch (updateError) {
        console.warn(
          `[setActiveSchema] Error updating schema active status:`,
          updateError
        );
        // Continue even if this fails - the field might not exist
      }

      return true;
    } catch (error) {
      console.error(
        `[SchemaService] Error setting active schema ${schemaId} for project ${projectId}:`,
        error
      );
      throw error;
    }
  }

  // These methods are no longer needed since we're using Prisma's API
  // which handles schema validation automatically
}

export default new SchemaService();

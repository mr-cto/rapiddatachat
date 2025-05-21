import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "./prisma/replicaClient";

const prisma = getPrismaClient();

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
      // Use the optimized ColumnMappingService for getting column mappings
      const { ColumnMappingService } = await import(
        "./schema/columnMappingService"
      );
      return ColumnMappingService.getColumnMapping(fileId, schemaId);
    } catch (error) {
      console.error(
        `[SchemaService] Error getting column mapping for file ${fileId} and schema ${schemaId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Save column mapping
   * @param mapping Column mapping
   * @returns Promise<boolean> Success
   */
  async saveColumnMapping(mapping: ColumnMapping): Promise<boolean> {
    try {
      // Use the optimized ColumnMappingService for saving column mappings
      const { ColumnMappingService } = await import(
        "./schema/columnMappingService"
      );
      return ColumnMappingService.saveColumnMapping(mapping);
    } catch (error) {
      console.error(
        `[SchemaService] Error saving column mapping for file ${mapping.fileId} and schema ${mapping.schemaId}:`,
        error
      );
      return false;
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
      const globalSchema = await (prisma as any).useReplica(
        async (replicaClient: PrismaClient) => {
          return await replicaClient.globalSchema.create({
            data: {
              id: schemaId,
              // Note: In the Prisma schema, fields use camelCase but are mapped to snake_case in DB
              // The userId field might not be in the Prisma schema, so we'll handle it differently
              projectId: projectId,
              name: name,
              description: description || null,
            },
          });
        }
      );

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
            const schemaColumn = await (prisma as any).useReplica(
              async (replicaClient: PrismaClient) => {
                return await replicaClient.schemaColumn.create({
                  data: {
                    id: columnId,
                    globalSchemaId: schemaId,
                    name: column.name,
                    description: column.description || null,
                    dataType: column.type,
                    isRequired: column.isRequired || false,
                  },
                });
              }
            );

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
      const createdSchema = await (prisma as any).useReplica(
        async (replicaClient: PrismaClient) => {
          return await replicaClient.globalSchema.findUnique({
            where: { id: schemaId },
            include: { columns: true },
          });
        }
      );

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
      const schema = await (prisma as any).useReplica(
        async (replicaClient: PrismaClient) => {
          return await replicaClient.globalSchema.findUnique({
            where: { id: schemaId },
            include: { columns: true },
          });
        }
      );

      console.log(`[getGlobalSchemaById] Schema found:`, schema ? "yes" : "no");

      if (!schema) {
        return null;
      }

      console.log(`[getGlobalSchemaById] Schema columns:`, schema.columns);

      // Convert Prisma model to our interface format
      const schemaColumns: SchemaColumn[] = schema.columns.map(
        (column: any) => ({
          id: column.id,
          name: column.name,
          type: column.dataType,
          description: column.description || undefined,
          isRequired: column.isRequired || false,
          isPrimaryKey: false, // Default value as it's not in the Prisma schema
          defaultValue: undefined, // Default value as it's not in the Prisma schema
          derivationFormula: undefined, // Default value as it's not in the Prisma schema
          isNewColumn: false, // Default value as it's not in the Prisma schema
        })
      );

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
      const schemas = await (prisma as any).useReplica(
        async (replicaClient: PrismaClient) => {
          return await replicaClient.globalSchema.findMany({
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
        }
      );

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
      return schemas.map((schema: any) => {
        // Convert schema columns
        const schemaColumns: SchemaColumn[] = schema.columns.map(
          (column: any) => ({
            id: column.id,
            name: column.name,
            type: column.dataType,
            description: column.description || undefined,
            isRequired: column.isRequired || false,
            isPrimaryKey: false, // Default value as it's not in the Prisma schema
            defaultValue: undefined, // Default value as it's not in the Prisma schema
            derivationFormula: undefined, // Default value as it's not in the Prisma schema
            isNewColumn: false, // Default value as it's not in the Prisma schema
          })
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
      console.log(`[SchemaService] Updating schema ${schema.id}`);

      // Use the optimized SchemaUpdateService for schema updates
      const { SchemaUpdateService } = await import(
        "./schema/schemaUpdateService"
      );

      // Convert columns to the format expected by SchemaUpdateService
      const formattedColumns = schema.columns.map((column) => ({
        id: column.id,
        name: column.name,
        description: column.description,
        dataType: column.type,
        isRequired: column.isRequired || false,
      }));

      // Use the optimized service to update the schema
      const updatedSchema = await SchemaUpdateService.updateGlobalSchema(
        schema.id,
        schema.projectId,
        schema.name,
        schema.description || null,
        formattedColumns
      );

      // Convert the result back to the GlobalSchema interface format
      return {
        id: updatedSchema.id,
        userId: schema.userId, // Preserve the original userId
        projectId: updatedSchema.projectId,
        name: updatedSchema.name,
        description: updatedSchema.description || undefined,
        columns: updatedSchema.columns.map((column: any) => ({
          id: column.id,
          name: column.name,
          type: column.dataType,
          description: column.description || undefined,
          isRequired: column.isRequired,
          isPrimaryKey: false, // Default value as it's not in the Prisma schema
          defaultValue: undefined, // Default value as it's not in the Prisma schema
          derivationFormula: undefined, // Default value as it's not in the Prisma schema
          isNewColumn: false, // Default value as it's not in the Prisma schema
        })),
        createdAt: updatedSchema.createdAt,
        updatedAt: updatedSchema.updatedAt,
        isActive: true, // Default value as it's not in the Prisma schema
        version: schema.version || 1, // Preserve the original version
        previousVersionId: schema.previousVersionId, // Preserve the original previousVersionId
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
      console.log(`[deleteGlobalSchema] Deleting schema ${schemaId}`);

      // Use a transaction to ensure all related records are deleted
      return await (prisma as any).useReplica(
        async (replicaClient: PrismaClient) => {
          return await replicaClient.$transaction(async (tx) => {
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
        }
      );
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
      const schema = await (prisma as any).useReplica(
        async (replicaClient: PrismaClient) => {
          return await replicaClient.globalSchema.findUnique({
            where: { id: schemaId },
          });
        }
      );

      if (!schema) {
        console.error(`[setActiveSchema] Schema ${schemaId} not found`);
        return false;
      }

      // We'll use a custom query approach since the Prisma schema might not have the isActive field
      try {
        // Check if the is_active column exists
        const columnExists = await (prisma as any).useReplica(
          async (replicaClient: PrismaClient) => {
            return await replicaClient.$queryRaw`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'global_schemas' AND column_name = 'is_active'
            ) as exists
          `;
          }
        );

        const isActiveColumnExists = (columnExists as any)[0]?.exists || false;

        if (isActiveColumnExists) {
          // First, set all schemas for this project to inactive using a raw query
          await (prisma as any).useReplica(
            async (replicaClient: PrismaClient) => {
              return await replicaClient.$executeRaw`
              UPDATE global_schemas
              SET is_active = false
              WHERE project_id = ${projectId}
              AND id != ${schemaId}
            `;
            }
          );

          console.log(
            `[setActiveSchema] Set all other schemas for project ${projectId} to inactive`
          );

          // Then set this schema to active
          await (prisma as any).useReplica(
            async (replicaClient: PrismaClient) => {
              return await replicaClient.$executeRaw`
              UPDATE global_schemas
              SET is_active = true
              WHERE id = ${schemaId}
            `;
            }
          );

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

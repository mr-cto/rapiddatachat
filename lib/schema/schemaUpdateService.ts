import { PrismaClient, Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { getConnectionManager } from "../database/connectionManager";
import {
  getAccelerateConfig,
  isPrismaAccelerate,
} from "../prisma/accelerateConfig";

/**
 * Service for optimized schema updates using transactions and differential updates
 */
export class SchemaUpdateService {
  /**
   * Update a global schema with optimized transaction-based approach
   * @param schemaId Schema ID
   * @param name Schema name
   * @param description Schema description
   * @param columns Schema columns
   * @returns Promise<any> Updated schema
   */
  static async updateGlobalSchema(
    schemaId: string,
    projectId: string,
    name: string,
    description: string | null,
    columns: Array<{
      id?: string;
      name: string;
      description?: string | null;
      dataType: string;
      isRequired: boolean;
    }>
  ): Promise<any> {
    try {
      console.log(`[SchemaUpdateService] Updating schema ${schemaId}`);

      // Get connection manager
      const connectionManager = getConnectionManager();

      // Get a replica client from the pool
      const replicaClient = connectionManager.getReplicaClient();

      try {
        // Get Prisma Accelerate configuration and log it
        const accelerateConfig = getAccelerateConfig();
        console.log(`[SchemaUpdateService] Accelerate config:`, {
          useTransactions: accelerateConfig.useTransactions,
          timeout: accelerateConfig.timeout,
          maxWait: accelerateConfig.maxWait,
          isAccelerate: accelerateConfig.isAccelerate,
        });

        // Always use non-transactional approach for Prisma Accelerate
        if (
          accelerateConfig.isAccelerate ||
          !accelerateConfig.useTransactions
        ) {
          // For Prisma Accelerate, avoid transactions due to timeout limitations
          console.log(
            `[SchemaUpdateService] Using non-transactional approach for schema update (Prisma Accelerate detected)`
          );

          // First, get the existing schema
          const existingSchema = await replicaClient.globalSchema.findUnique({
            where: { id: schemaId },
            include: { columns: true },
          });

          if (!existingSchema) {
            throw new Error(`Schema ${schemaId} not found`);
          }

          console.log(
            `[SchemaUpdateService] Found schema with ${existingSchema.columns.length} columns`
          );

          // Update the schema
          const updatedSchema = await replicaClient.globalSchema.update({
            where: { id: schemaId },
            data: {
              name,
              description,
              updatedAt: new Date(),
            },
          });

          console.log(`[SchemaUpdateService] Updated schema metadata`);

          // Create a map of existing columns by name for faster lookup
          const existingColumnsMap = new Map();
          existingSchema.columns.forEach((column) => {
            existingColumnsMap.set(column.name.toLowerCase(), column);
          });

          // Prepare column operations
          const columnsToCreate: any[] = [];
          const columnsToUpdate: any[] = [];
          const processedColumnIds = new Set<string>();

          // Process each column
          for (const column of columns) {
            const normalizedColumnName = column.name.toLowerCase();
            const existingColumn = existingColumnsMap.get(normalizedColumnName);

            if (existingColumn) {
              // Column exists, check if it needs to be updated
              const needsUpdate =
                existingColumn.description !== (column.description || null) ||
                existingColumn.dataType !== column.dataType ||
                existingColumn.isRequired !== column.isRequired;

              if (needsUpdate) {
                columnsToUpdate.push({
                  id: existingColumn.id,
                  description: column.description || null,
                  dataType: column.dataType,
                  isRequired: column.isRequired,
                });
              }

              // Mark this column as processed
              processedColumnIds.add(existingColumn.id);
            } else {
              // Column doesn't exist, create it
              columnsToCreate.push({
                id: column.id || `col_${uuidv4()}`,
                globalSchemaId: schemaId,
                name: column.name,
                description: column.description || null,
                dataType: column.dataType,
                isRequired: column.isRequired,
              });
            }
          }

          // Find columns to delete (columns that exist but weren't in the update)
          const columnsToDelete = existingSchema.columns
            .filter((column) => !processedColumnIds.has(column.id))
            .map((column) => column.id);

          // Execute column operations

          // 1. Create new columns
          if (columnsToCreate.length > 0) {
            await replicaClient.schemaColumn.createMany({
              data: columnsToCreate,
            });
            console.log(
              `[SchemaUpdateService] Created ${columnsToCreate.length} new columns`
            );
          }

          // 2. Update existing columns
          for (const column of columnsToUpdate) {
            await replicaClient.schemaColumn.update({
              where: { id: column.id },
              data: {
                description: column.description,
                dataType: column.dataType,
                isRequired: column.isRequired,
              },
            });
          }

          if (columnsToUpdate.length > 0) {
            console.log(
              `[SchemaUpdateService] Updated ${columnsToUpdate.length} existing columns`
            );
          }

          // 3. Delete removed columns
          if (columnsToDelete.length > 0) {
            // First, delete any column mappings that reference these columns
            await replicaClient.columnMapping.deleteMany({
              where: {
                schemaColumnId: {
                  in: columnsToDelete,
                },
              },
            });

            // Then delete the columns
            await replicaClient.schemaColumn.deleteMany({
              where: {
                id: {
                  in: columnsToDelete,
                },
              },
            });

            console.log(
              `[SchemaUpdateService] Deleted ${columnsToDelete.length} removed columns`
            );
          }

          // Get the updated schema with columns
          const result = await replicaClient.globalSchema.findUnique({
            where: { id: schemaId },
            include: { columns: true },
          });

          console.log(
            `[SchemaUpdateService] Schema update complete with ${result?.columns.length} columns`
          );

          return result;
        } else {
          // For direct database connections, use transactions with appropriate timeouts
          return await replicaClient.$transaction(
            async (tx) => {
              // First, get the existing schema
              const existingSchema = await tx.globalSchema.findUnique({
                where: { id: schemaId },
                include: { columns: true },
              });

              if (!existingSchema) {
                throw new Error(`Schema ${schemaId} not found`);
              }

              console.log(
                `[SchemaUpdateService] Found schema with ${existingSchema.columns.length} columns`
              );

              // Update the schema
              const updatedSchema = await tx.globalSchema.update({
                where: { id: schemaId },
                data: {
                  name,
                  description,
                  updatedAt: new Date(),
                },
              });

              console.log(`[SchemaUpdateService] Updated schema metadata`);

              // Create a map of existing columns by name for faster lookup
              const existingColumnsMap = new Map();
              existingSchema.columns.forEach((column) => {
                existingColumnsMap.set(column.name.toLowerCase(), column);
              });

              // Prepare column operations
              const columnsToCreate: any[] = [];
              const columnsToUpdate: any[] = [];
              const processedColumnIds = new Set<string>();

              // Process each column
              for (const column of columns) {
                const normalizedColumnName = column.name.toLowerCase();
                const existingColumn =
                  existingColumnsMap.get(normalizedColumnName);

                if (existingColumn) {
                  // Column exists, check if it needs to be updated
                  const needsUpdate =
                    existingColumn.description !==
                      (column.description || null) ||
                    existingColumn.dataType !== column.dataType ||
                    existingColumn.isRequired !== column.isRequired;

                  if (needsUpdate) {
                    columnsToUpdate.push({
                      id: existingColumn.id,
                      description: column.description || null,
                      dataType: column.dataType,
                      isRequired: column.isRequired,
                    });
                  }

                  // Mark this column as processed
                  processedColumnIds.add(existingColumn.id);
                } else {
                  // Column doesn't exist, create it
                  columnsToCreate.push({
                    id: column.id || `col_${uuidv4()}`,
                    globalSchemaId: schemaId,
                    name: column.name,
                    description: column.description || null,
                    dataType: column.dataType,
                    isRequired: column.isRequired,
                  });
                }
              }

              // Find columns to delete (columns that exist but weren't in the update)
              const columnsToDelete = existingSchema.columns
                .filter((column) => !processedColumnIds.has(column.id))
                .map((column) => column.id);

              // Execute column operations

              // 1. Create new columns
              if (columnsToCreate.length > 0) {
                await tx.schemaColumn.createMany({
                  data: columnsToCreate,
                });
                console.log(
                  `[SchemaUpdateService] Created ${columnsToCreate.length} new columns`
                );
              }

              // 2. Update existing columns
              for (const column of columnsToUpdate) {
                await tx.schemaColumn.update({
                  where: { id: column.id },
                  data: {
                    description: column.description,
                    dataType: column.dataType,
                    isRequired: column.isRequired,
                  },
                });
              }

              if (columnsToUpdate.length > 0) {
                console.log(
                  `[SchemaUpdateService] Updated ${columnsToUpdate.length} existing columns`
                );
              }

              // 3. Delete removed columns
              if (columnsToDelete.length > 0) {
                // First, delete any column mappings that reference these columns
                await tx.columnMapping.deleteMany({
                  where: {
                    schemaColumnId: {
                      in: columnsToDelete,
                    },
                  },
                });

                // Then delete the columns
                await tx.schemaColumn.deleteMany({
                  where: {
                    id: {
                      in: columnsToDelete,
                    },
                  },
                });

                console.log(
                  `[SchemaUpdateService] Deleted ${columnsToDelete.length} removed columns`
                );
              }

              // Get the updated schema with columns
              const result = await tx.globalSchema.findUnique({
                where: { id: schemaId },
                include: { columns: true },
              });

              console.log(
                `[SchemaUpdateService] Schema update complete with ${result?.columns.length} columns`
              );

              return result;
            },
            {
              timeout: accelerateConfig.timeout,
              maxWait: accelerateConfig.maxWait,
              isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            }
          );
        }
      } catch (error) {
        console.error(
          `[SchemaUpdateService] Transaction error updating schema:`,
          error
        );
        throw error;
      } finally {
        // Release the client back to the pool
        connectionManager.releaseReplicaClient(replicaClient);
      }
    } catch (error) {
      console.error(
        `[SchemaUpdateService] Error updating schema ${schemaId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Create a new global schema with optimized transaction-based approach
   * @param name Schema name
   * @param description Schema description
   * @param columns Schema columns
   * @returns Promise<any> Created schema
   */
  static async createGlobalSchema(
    projectId: string,
    name: string,
    description: string | null,
    columns: Array<{
      name: string;
      description?: string | null;
      dataType: string;
      isRequired: boolean;
    }>
  ): Promise<any> {
    try {
      console.log(`[SchemaUpdateService] Creating schema: ${name}`);

      // Get connection manager
      const connectionManager = getConnectionManager();

      // Get a replica client from the pool
      const replicaClient = connectionManager.getReplicaClient();

      try {
        // Get Prisma Accelerate configuration and log it
        const accelerateConfig = getAccelerateConfig();
        console.log(`[SchemaUpdateService] Accelerate config:`, {
          useTransactions: accelerateConfig.useTransactions,
          timeout: accelerateConfig.timeout,
          maxWait: accelerateConfig.maxWait,
          isAccelerate: accelerateConfig.isAccelerate,
        });

        // Generate a UUID for the schema
        const schemaId = `schema_${uuidv4()}`;

        // Always use non-transactional approach for Prisma Accelerate
        if (
          accelerateConfig.isAccelerate ||
          !accelerateConfig.useTransactions
        ) {
          // For Prisma Accelerate, avoid transactions due to timeout limitations
          console.log(
            `[SchemaUpdateService] Using non-transactional approach (Prisma Accelerate detected)`
          );

          // Create the schema
          const schema = await replicaClient.globalSchema.create({
            data: {
              id: schemaId,
              name,
              description,
              projectId,
            },
          });

          console.log(`[SchemaUpdateService] Created schema: ${schema.id}`);

          // Prepare columns with IDs
          const columnsWithIds = columns.map((column) => ({
            id: `col_${uuidv4()}`,
            globalSchemaId: schemaId,
            name: column.name,
            description: column.description || null,
            dataType: column.dataType,
            isRequired: column.isRequired,
          }));

          // Create columns in batch
          if (columnsWithIds.length > 0) {
            await replicaClient.schemaColumn.createMany({
              data: columnsWithIds,
            });

            console.log(
              `[SchemaUpdateService] Created ${columnsWithIds.length} columns for schema ${schemaId}`
            );
          }

          // Get the created schema with columns
          const result = await replicaClient.globalSchema.findUnique({
            where: { id: schemaId },
            include: { columns: true },
          });

          console.log(
            `[SchemaUpdateService] Schema creation complete with ${result?.columns.length} columns`
          );

          return result;
        } else {
          // For direct database connections, use transactions with appropriate timeouts
          return await replicaClient.$transaction(
            async (tx) => {
              // Create the schema
              const schema = await tx.globalSchema.create({
                data: {
                  id: schemaId,
                  name,
                  description,
                  projectId,
                },
              });

              console.log(`[SchemaUpdateService] Created schema: ${schema.id}`);

              // Prepare columns with IDs
              const columnsWithIds = columns.map((column) => ({
                id: `col_${uuidv4()}`,
                globalSchemaId: schemaId,
                name: column.name,
                description: column.description || null,
                dataType: column.dataType,
                isRequired: column.isRequired,
              }));

              // Create columns in batch
              if (columnsWithIds.length > 0) {
                await tx.schemaColumn.createMany({
                  data: columnsWithIds,
                });

                console.log(
                  `[SchemaUpdateService] Created ${columnsWithIds.length} columns for schema ${schemaId}`
                );
              }

              // Get the created schema with columns
              const result = await tx.globalSchema.findUnique({
                where: { id: schemaId },
                include: { columns: true },
              });

              console.log(
                `[SchemaUpdateService] Schema creation complete with ${result?.columns.length} columns`
              );

              return result;
            },
            {
              timeout: accelerateConfig.timeout,
              maxWait: accelerateConfig.maxWait,
              isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            }
          );
        }
      } catch (error) {
        console.error(
          `[SchemaUpdateService] Transaction error creating schema:`,
          error
        );
        throw error;
      } finally {
        // Release the client back to the pool
        connectionManager.releaseReplicaClient(replicaClient);
      }
    } catch (error) {
      console.error(`[SchemaUpdateService] Error creating schema:`, error);
      throw error;
    }
  }
}

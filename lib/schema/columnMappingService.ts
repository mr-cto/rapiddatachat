import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { getConnectionManager } from "../database/connectionManager";
import { ColumnMapping } from "../schemaManagement";
import { getAccelerateConfig } from "../prisma/accelerateConfig";

/**
 * Service for managing column mappings with optimized database access
 */
export class ColumnMappingService {
  /**
   * Save column mapping using transaction-based approach
   * @param mapping Column mapping to save
   * @returns Promise<boolean> Success
   */
  static async saveColumnMapping(mapping: ColumnMapping): Promise<boolean> {
    try {
      console.log(
        `[ColumnMappingService] Saving mapping for schema ${mapping.schemaId}`
      );

      // Get connection manager
      const connectionManager = getConnectionManager();

      // Get a replica client from the pool
      const replicaClient = connectionManager.getReplicaClient();

      try {
        // Get Prisma Accelerate configuration and log it
        const accelerateConfig = getAccelerateConfig();
        console.log(`[ColumnMappingService] Accelerate config:`, {
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
            `[ColumnMappingService] Using non-transactional approach (Prisma Accelerate detected)`
          );

          // Get schema columns in a single query
          const schema = await replicaClient.globalSchema.findUnique({
            where: { id: mapping.schemaId },
            include: { columns: true },
          });

          if (!schema) {
            console.error(
              `[ColumnMappingService] Schema ${mapping.schemaId} not found`
            );
            throw new Error(`Schema ${mapping.schemaId} not found`);
          }

          console.log(
            `[ColumnMappingService] Found schema with ${schema.columns.length} columns`
          );

          // Delete existing mappings for this file and schema
          await replicaClient.columnMapping.deleteMany({
            where: {
              fileId: mapping.fileId,
              globalSchemaId: mapping.schemaId,
            },
          });

          console.log(`[ColumnMappingService] Deleted existing mappings`);

          // Normalize column names for comparison (remove spaces, special chars, lowercase)
          const normalizeColumnName = (name: string): string => {
            return name.toLowerCase().replace(/[^a-z0-9]/gi, "");
          };

          // Create a map of normalized column names to schema columns for faster lookup
          const normalizedColumnMap = new Map<string, any>();
          schema.columns.forEach((col) => {
            normalizedColumnMap.set(normalizeColumnName(col.name), col);
          });

          // Prepare mappings to create
          const mappingsToCreate: any[] = [];
          const newColumnsToCreate: any[] = [];

          // For each file column to schema column mapping
          for (const [fileColumn, schemaColumnName] of Object.entries(
            mapping.mappings
          )) {
            const normalizedSchemaColumnName =
              normalizeColumnName(schemaColumnName);

            // Find the schema column by name with normalized comparison
            const schemaColumn = normalizedColumnMap.get(
              normalizedSchemaColumnName
            );

            if (schemaColumn) {
              // Add to batch of mappings to create
              mappingsToCreate.push({
                fileId: mapping.fileId,
                globalSchemaId: mapping.schemaId,
                schemaColumnId: schemaColumn.id,
                fileColumn: fileColumn,
              });
            } else {
              // Create a new column ID
              const columnId = `col_${uuidv4()}`;

              // Add to batch of columns to create
              newColumnsToCreate.push({
                id: columnId,
                globalSchemaId: mapping.schemaId,
                name: schemaColumnName,
                description: null,
                dataType: "text", // Default to text type
                isRequired: false,
              });

              // Add to batch of mappings to create
              mappingsToCreate.push({
                fileId: mapping.fileId,
                globalSchemaId: mapping.schemaId,
                schemaColumnId: columnId,
                fileColumn: fileColumn,
              });
            }
          }

          // Create new columns in batch if needed
          if (newColumnsToCreate.length > 0) {
            await replicaClient.schemaColumn.createMany({
              data: newColumnsToCreate,
              skipDuplicates: true,
            });

            console.log(
              `[ColumnMappingService] Created ${newColumnsToCreate.length} new schema columns`
            );
          }

          // Create new mappings in batch with size limits
          if (mappingsToCreate.length > 0) {
            // Check if we need to split into smaller batches
            const batchSize = accelerateConfig.isAccelerate ? 100 : 500;

            if (mappingsToCreate.length > batchSize) {
              console.log(
                `[ColumnMappingService] Large mapping detected (${mappingsToCreate.length} mappings), using batched approach with batch size ${batchSize}`
              );

              // Process in smaller batches
              for (let i = 0; i < mappingsToCreate.length; i += batchSize) {
                const batch = mappingsToCreate.slice(i, i + batchSize);
                await replicaClient.columnMapping.createMany({
                  data: batch,
                  skipDuplicates: true,
                });
                console.log(
                  `[ColumnMappingService] Created batch ${
                    Math.floor(i / batchSize) + 1
                  }/${Math.ceil(mappingsToCreate.length / batchSize)} (${
                    batch.length
                  } mappings)`
                );
              }
            } else {
              // Process in a single batch
              await replicaClient.columnMapping.createMany({
                data: mappingsToCreate,
                skipDuplicates: true,
              });
            }

            console.log(
              `[ColumnMappingService] Created ${mappingsToCreate.length} column mappings total`
            );
          }

          return true;
        } else {
          // For direct database connections, use transactions with appropriate timeouts
          return await replicaClient.$transaction(
            async (tx) => {
              // Get schema columns in a single query
              const schema = await tx.globalSchema.findUnique({
                where: { id: mapping.schemaId },
                include: { columns: true },
              });

              if (!schema) {
                console.error(
                  `[ColumnMappingService] Schema ${mapping.schemaId} not found`
                );
                throw new Error(`Schema ${mapping.schemaId} not found`);
              }

              console.log(
                `[ColumnMappingService] Found schema with ${schema.columns.length} columns`
              );

              // Delete existing mappings for this file and schema
              await tx.columnMapping.deleteMany({
                where: {
                  fileId: mapping.fileId,
                  globalSchemaId: mapping.schemaId,
                },
              });

              console.log(`[ColumnMappingService] Deleted existing mappings`);

              // Normalize column names for comparison (remove spaces, special chars, lowercase)
              const normalizeColumnName = (name: string): string => {
                return name.toLowerCase().replace(/[^a-z0-9]/gi, "");
              };

              // Create a map of normalized column names to schema columns for faster lookup
              const normalizedColumnMap = new Map<string, any>();
              schema.columns.forEach((col) => {
                normalizedColumnMap.set(normalizeColumnName(col.name), col);
              });

              // Prepare mappings to create
              const mappingsToCreate: any[] = [];
              const newColumnsToCreate: any[] = [];

              // For each file column to schema column mapping
              for (const [fileColumn, schemaColumnName] of Object.entries(
                mapping.mappings
              )) {
                const normalizedSchemaColumnName =
                  normalizeColumnName(schemaColumnName);

                // Find the schema column by name with normalized comparison
                const schemaColumn = normalizedColumnMap.get(
                  normalizedSchemaColumnName
                );

                if (schemaColumn) {
                  // Add to batch of mappings to create
                  mappingsToCreate.push({
                    fileId: mapping.fileId,
                    globalSchemaId: mapping.schemaId,
                    schemaColumnId: schemaColumn.id,
                    fileColumn: fileColumn,
                  });
                } else {
                  // Create a new column ID
                  const columnId = `col_${uuidv4()}`;

                  // Add to batch of columns to create
                  newColumnsToCreate.push({
                    id: columnId,
                    globalSchemaId: mapping.schemaId,
                    name: schemaColumnName,
                    description: null,
                    dataType: "text", // Default to text type
                    isRequired: false,
                  });

                  // Add to batch of mappings to create
                  mappingsToCreate.push({
                    fileId: mapping.fileId,
                    globalSchemaId: mapping.schemaId,
                    schemaColumnId: columnId,
                    fileColumn: fileColumn,
                  });
                }
              }

              // Create new columns in batch if needed
              if (newColumnsToCreate.length > 0) {
                await tx.schemaColumn.createMany({
                  data: newColumnsToCreate,
                  skipDuplicates: true,
                });

                console.log(
                  `[ColumnMappingService] Created ${newColumnsToCreate.length} new schema columns`
                );
              }

              // Create new mappings in batch with size limits
              if (mappingsToCreate.length > 0) {
                // Check if we need to split into smaller batches
                const batchSize = accelerateConfig.isAccelerate ? 100 : 500;

                if (mappingsToCreate.length > batchSize) {
                  console.log(
                    `[ColumnMappingService] Large mapping detected (${mappingsToCreate.length} mappings), using batched approach with batch size ${batchSize}`
                  );

                  // Process in smaller batches
                  for (let i = 0; i < mappingsToCreate.length; i += batchSize) {
                    const batch = mappingsToCreate.slice(i, i + batchSize);
                    await tx.columnMapping.createMany({
                      data: batch,
                      skipDuplicates: true,
                    });
                    console.log(
                      `[ColumnMappingService] Created batch ${
                        Math.floor(i / batchSize) + 1
                      }/${Math.ceil(mappingsToCreate.length / batchSize)} (${
                        batch.length
                      } mappings)`
                    );
                  }
                } else {
                  // Process in a single batch
                  await tx.columnMapping.createMany({
                    data: mappingsToCreate,
                    skipDuplicates: true,
                  });
                }

                console.log(
                  `[ColumnMappingService] Created ${mappingsToCreate.length} column mappings total`
                );
              }

              return true;
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
          `[ColumnMappingService] Transaction error saving column mapping:`,
          error
        );
        throw error;
      } finally {
        // Release the client back to the pool
        connectionManager.releaseReplicaClient(replicaClient);
      }
    } catch (error) {
      console.error(
        `[ColumnMappingService] Error saving column mapping for file ${mapping.fileId} and schema ${mapping.schemaId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Get column mapping for a file and schema
   * @param fileId File ID
   * @param schemaId Schema ID
   * @returns Promise<ColumnMapping | null> Column mapping or null if not found
   */
  static async getColumnMapping(
    fileId: string,
    schemaId: string
  ): Promise<ColumnMapping | null> {
    try {
      // Get connection manager
      const connectionManager = getConnectionManager();

      // Get a replica client from the pool
      const replicaClient = connectionManager.getReplicaClient();

      try {
        // Use Prisma to find column mappings
        const columnMappings = await replicaClient.columnMapping.findMany({
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
      } finally {
        // Release the client back to the pool
        connectionManager.releaseReplicaClient(replicaClient);
      }
    } catch (error) {
      console.error(
        `[ColumnMappingService] Error getting column mapping for file ${fileId} and schema ${schemaId}:`,
        error
      );
      return null;
    }
  }
}

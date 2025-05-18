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
        // Get Prisma Accelerate configuration
        const accelerateConfig = getAccelerateConfig();

        // Log the Accelerate detection status for debugging
        console.log(
          `[ColumnMappingService] Prisma Accelerate detected: ${
            accelerateConfig.isAccelerate ? "Yes" : "No"
          }`
        );

        if (
          accelerateConfig.isAccelerate ||
          !accelerateConfig.useTransactions
        ) {
          // For Prisma Accelerate, avoid transactions due to timeout limitations
          console.log(
            `[ColumnMappingService] Using non-transactional approach (Prisma Accelerate detected or transactions disabled)`
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

          // Get mapping entries
          const mappingEntries = Object.entries(mapping.mappings);

          // Log the number of mappings for debugging
          console.log(
            `[ColumnMappingService] Processing ${mappingEntries.length} column mappings (non-transactional)`
          );

          // Set a reasonable batch size limit to prevent timeouts
          const BATCH_SIZE_LIMIT = accelerateConfig.isAccelerate ? 100 : 500;

          // If we have too many mappings, log a warning
          if (mappingEntries.length > BATCH_SIZE_LIMIT) {
            console.warn(
              `[ColumnMappingService] Large mapping operation detected (${mappingEntries.length} mappings). Processing first ${BATCH_SIZE_LIMIT} to prevent timeout.`
            );
          }

          // For each file column to schema column mapping (with batch size limit)
          for (const [fileColumn, schemaColumnName] of mappingEntries.slice(
            0,
            BATCH_SIZE_LIMIT
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

          // Create new mappings in batch
          if (mappingsToCreate.length > 0) {
            await replicaClient.columnMapping.createMany({
              data: mappingsToCreate,
              skipDuplicates: true,
            });

            console.log(
              `[ColumnMappingService] Created ${mappingsToCreate.length} column mappings`
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

              // Get mapping entries
              const mappingEntries = Object.entries(mapping.mappings);

              // Log the number of mappings for debugging
              console.log(
                `[ColumnMappingService] Processing ${mappingEntries.length} column mappings`
              );

              // Set a reasonable batch size limit to prevent timeouts
              const BATCH_SIZE_LIMIT = accelerateConfig.isAccelerate
                ? 100
                : 500;

              // If we have too many mappings, log a warning
              if (mappingEntries.length > BATCH_SIZE_LIMIT) {
                console.warn(
                  `[ColumnMappingService] Large mapping operation detected (${mappingEntries.length} mappings). Processing first ${BATCH_SIZE_LIMIT} to prevent timeout.`
                );
              }

              // For each file column to schema column mapping (with batch size limit)
              for (const [fileColumn, schemaColumnName] of mappingEntries.slice(
                0,
                BATCH_SIZE_LIMIT
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

              // Create new mappings in batch
              if (mappingsToCreate.length > 0) {
                await tx.columnMapping.createMany({
                  data: mappingsToCreate,
                  skipDuplicates: true,
                });

                console.log(
                  `[ColumnMappingService] Created ${mappingsToCreate.length} column mappings`
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

          // Log transaction configuration for debugging
          console.log(
            `[ColumnMappingService] Transaction completed with timeout: ${accelerateConfig.timeout}ms, maxWait: ${accelerateConfig.maxWait}ms`
          );
        }
      } catch (error) {
        console.error(
          `[ColumnMappingService] Transaction error saving column mapping for file ${mapping.fileId} and schema ${mapping.schemaId}:`,
          error
        );
        // Log additional details about the mapping
        console.error(
          `[ColumnMappingService] Mapping details: ${
            Object.keys(mapping.mappings).length
          } mappings`,
          {
            fileId: mapping.fileId,
            schemaId: mapping.schemaId,
            sampleMappings: Object.entries(mapping.mappings).slice(0, 3),
            errorName: error instanceof Error ? error.name : "Unknown",
            errorMessage:
              error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : "No stack trace",
          }
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
      // Log additional details about the mapping
      console.error(
        `[ColumnMappingService] Mapping details: ${
          Object.keys(mapping.mappings).length
        } mappings`,
        {
          fileId: mapping.fileId,
          schemaId: mapping.schemaId,
          sampleMappings: Object.entries(mapping.mappings).slice(0, 3),
          errorName: error instanceof Error ? error.name : "Unknown",
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : "No stack trace",
        }
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

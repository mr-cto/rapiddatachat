import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { getConnectionManager } from "../database/connectionManager";
import { ColumnMapping } from "../schemaManagement";
import { getAccelerateConfig } from "../prisma/accelerateConfig";

/**
 * Service for managing column mappings with optimized database access
 * Includes fallback for when the column_mappings table doesn't exist
 */
export class ColumnMappingServiceFallback {
  // In-memory storage for column mappings when the database table doesn't exist
  private static inMemoryMappings: Map<string, ColumnMapping> = new Map();

  /**
   * Generate a unique key for storing mappings in memory
   * @param fileId File ID
   * @param schemaId Schema ID
   * @returns Unique key
   */
  private static getMapKey(fileId: string, schemaId: string): string {
    return `${fileId}:${schemaId}`;
  }

  /**
   * Save column mapping using transaction-based approach with fallback to in-memory storage
   * @param mapping Column mapping to save
   * @returns Promise<boolean> Success
   */
  static async saveColumnMapping(mapping: ColumnMapping): Promise<boolean> {
    try {
      console.log(
        `[ColumnMappingServiceFallback] Saving mapping for schema ${mapping.schemaId}`
      );

      // Get connection manager
      const connectionManager = getConnectionManager();
      const replicaClient = connectionManager.getReplicaClient();

      try {
        // Get Prisma Accelerate configuration
        const accelerateConfig = getAccelerateConfig();
        const isAccelerate =
          accelerateConfig.isAccelerate || !accelerateConfig.useTransactions;

        // Get schema columns in a single query
        const schema = await replicaClient.globalSchema.findUnique({
          where: { id: mapping.schemaId },
          include: { columns: true },
        });

        if (!schema) {
          console.error(
            `[ColumnMappingServiceFallback] Schema ${mapping.schemaId} not found`
          );
          throw new Error(`Schema ${mapping.schemaId} not found`);
        }

        console.log(
          `[ColumnMappingServiceFallback] Found schema with ${schema.columns.length} columns`
        );

        try {
          // Try to delete existing mappings for this file and schema
          await (replicaClient as any).columnMapping.deleteMany({
            where: {
              fileId: mapping.fileId,
              globalSchemaId: mapping.schemaId,
            },
          });
          console.log(
            `[ColumnMappingServiceFallback] Deleted existing mappings`
          );
        } catch (deleteError) {
          // If the table doesn't exist, we'll use in-memory storage
          if (
            deleteError instanceof Prisma.PrismaClientKnownRequestError &&
            deleteError.code === "P2021"
          ) {
            console.log(
              `[ColumnMappingServiceFallback] column_mappings table doesn't exist, using in-memory storage`
            );

            // Store the mapping in memory
            const key = this.getMapKey(mapping.fileId, mapping.schemaId);
            this.inMemoryMappings.set(key, mapping);

            console.log(
              `[ColumnMappingServiceFallback] Saved mapping in memory with key ${key}`
            );

            return true;
          } else {
            // For other errors, rethrow
            throw deleteError;
          }
        }

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
            `[ColumnMappingServiceFallback] Created ${newColumnsToCreate.length} new schema columns`
          );
        }

        // Create new mappings in batch with size limits
        if (mappingsToCreate.length > 0) {
          try {
            // Use a consistent batch size
            const batchSize = 100;

            if (mappingsToCreate.length > batchSize) {
              // Process in smaller batches
              for (let i = 0; i < mappingsToCreate.length; i += batchSize) {
                const batch = mappingsToCreate.slice(i, i + batchSize);
                try {
                  await (replicaClient as any).columnMapping.createMany({
                    data: batch,
                    skipDuplicates: true,
                  });
                } catch (createError) {
                  // If the table doesn't exist, use in-memory storage
                  if (
                    createError instanceof
                      Prisma.PrismaClientKnownRequestError &&
                    createError.code === "P2021"
                  ) {
                    console.log(
                      `[ColumnMappingServiceFallback] column_mappings table doesn't exist, using in-memory storage`
                    );

                    // Store the mapping in memory
                    const key = this.getMapKey(
                      mapping.fileId,
                      mapping.schemaId
                    );
                    this.inMemoryMappings.set(key, mapping);

                    console.log(
                      `[ColumnMappingServiceFallback] Saved mapping in memory with key ${key}`
                    );

                    return true;
                  } else {
                    // For other errors, rethrow
                    throw createError;
                  }
                }

                // Only log first and last batch
                if (i === 0 || i + batchSize >= mappingsToCreate.length) {
                  console.log(
                    `[ColumnMappingServiceFallback] Created batch ${
                      Math.floor(i / batchSize) + 1
                    }/${Math.ceil(mappingsToCreate.length / batchSize)}`
                  );
                }
              }
            } else {
              // Process in a single batch
              try {
                await (replicaClient as any).columnMapping.createMany({
                  data: mappingsToCreate,
                  skipDuplicates: true,
                });
              } catch (createError) {
                // If the table doesn't exist, use in-memory storage
                if (
                  createError instanceof Prisma.PrismaClientKnownRequestError &&
                  createError.code === "P2021"
                ) {
                  console.log(
                    `[ColumnMappingServiceFallback] column_mappings table doesn't exist, using in-memory storage`
                  );

                  // Store the mapping in memory
                  const key = this.getMapKey(mapping.fileId, mapping.schemaId);
                  this.inMemoryMappings.set(key, mapping);

                  console.log(
                    `[ColumnMappingServiceFallback] Saved mapping in memory with key ${key}`
                  );

                  return true;
                } else {
                  // For other errors, rethrow
                  throw createError;
                }
              }
            }

            console.log(
              `[ColumnMappingServiceFallback] Created ${mappingsToCreate.length} column mappings total`
            );

            // Log transaction configuration for debugging
            console.log(
              `[ColumnMappingServiceFallback] Transaction completed with timeout: ${accelerateConfig.timeout}ms, maxWait: ${accelerateConfig.maxWait}ms`
            );
          } catch (batchError) {
            // If the table doesn't exist, use in-memory storage
            if (
              batchError instanceof Prisma.PrismaClientKnownRequestError &&
              batchError.code === "P2021"
            ) {
              console.log(
                `[ColumnMappingServiceFallback] column_mappings table doesn't exist, using in-memory storage`
              );

              // Store the mapping in memory
              const key = this.getMapKey(mapping.fileId, mapping.schemaId);
              this.inMemoryMappings.set(key, mapping);

              console.log(
                `[ColumnMappingServiceFallback] Saved mapping in memory with key ${key}`
              );

              return true;
            } else {
              // For other errors, rethrow
              throw batchError;
            }
          }
        }

        return true;
      } catch (error) {
        // Check if it's a "table doesn't exist" error
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2021"
        ) {
          console.log(
            `[ColumnMappingServiceFallback] column_mappings table doesn't exist, using in-memory storage`
          );

          // Store the mapping in memory
          const key = this.getMapKey(mapping.fileId, mapping.schemaId);
          this.inMemoryMappings.set(key, mapping);

          console.log(
            `[ColumnMappingServiceFallback] Saved mapping in memory with key ${key}`
          );

          return true;
        }

        console.error(
          `[ColumnMappingServiceFallback] Transaction error saving column mapping for file ${mapping.fileId} and schema ${mapping.schemaId}:`,
          error
        );
        // Log additional details about the mapping
        console.error(
          `[ColumnMappingServiceFallback] Mapping details: ${
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
      // Check if it's a "table doesn't exist" error
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2021"
      ) {
        console.log(
          `[ColumnMappingServiceFallback] column_mappings table doesn't exist, using in-memory storage`
        );

        // Store the mapping in memory
        const key = this.getMapKey(mapping.fileId, mapping.schemaId);
        this.inMemoryMappings.set(key, mapping);

        console.log(
          `[ColumnMappingServiceFallback] Saved mapping in memory with key ${key}`
        );

        return true;
      }

      console.error(
        `[ColumnMappingServiceFallback] Error saving column mapping for file ${mapping.fileId} and schema ${mapping.schemaId}:`,
        error
      );
      // Log additional details about the mapping
      console.error(
        `[ColumnMappingServiceFallback] Mapping details: ${
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
   * Get column mapping for a file and schema with fallback to in-memory storage
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
        try {
          const columnMappings = await (
            replicaClient as any
          ).columnMapping.findMany({
            where: {
              fileId: fileId,
              globalSchemaId: schemaId,
            },
            include: {
              schemaColumn: true,
            },
          });

          if (!columnMappings || columnMappings.length === 0) {
            // Check in-memory storage
            const key = this.getMapKey(fileId, schemaId);
            const inMemoryMapping = this.inMemoryMappings.get(key);

            if (inMemoryMapping) {
              console.log(
                `[ColumnMappingServiceFallback] Found mapping in memory with key ${key}`
              );
              return inMemoryMapping;
            }

            return null;
          }

          // Convert Prisma model to our interface format
          const mappings: Record<string, string> = {};

          // Each mapping maps a file column to a schema column
          columnMappings.forEach((mapping: any) => {
            mappings[mapping.fileColumn] = mapping.schemaColumn.name;
          });

          return {
            fileId,
            schemaId,
            mappings,
          };
        } catch (findError) {
          // If the table doesn't exist, check in-memory storage
          if (
            findError instanceof Prisma.PrismaClientKnownRequestError &&
            findError.code === "P2021"
          ) {
            console.log(
              `[ColumnMappingServiceFallback] column_mappings table doesn't exist, checking in-memory storage`
            );

            // Check in-memory storage
            const key = this.getMapKey(fileId, schemaId);
            const inMemoryMapping = this.inMemoryMappings.get(key);

            if (inMemoryMapping) {
              console.log(
                `[ColumnMappingServiceFallback] Found mapping in memory with key ${key}`
              );
              return inMemoryMapping;
            }

            return null;
          } else {
            // For other errors, rethrow
            throw findError;
          }
        }
      } finally {
        // Release the client back to the pool
        connectionManager.releaseReplicaClient(replicaClient);
      }
    } catch (error) {
      // Check if it's a "table doesn't exist" error
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2021"
      ) {
        console.log(
          `[ColumnMappingServiceFallback] column_mappings table doesn't exist, checking in-memory storage`
        );

        // Check in-memory storage
        const key = this.getMapKey(fileId, schemaId);
        const inMemoryMapping = this.inMemoryMappings.get(key);

        if (inMemoryMapping) {
          console.log(
            `[ColumnMappingServiceFallback] Found mapping in memory with key ${key}`
          );
          return inMemoryMapping;
        }

        return null;
      }

      console.error(
        `[ColumnMappingServiceFallback] Error getting column mapping for file ${fileId} and schema ${schemaId}:`,
        error
      );
      return null;
    }
  }
}

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
          // Use a consistent batch size
          const batchSize = 100;

          if (mappingsToCreate.length > batchSize) {
            // Process in smaller batches
            for (let i = 0; i < mappingsToCreate.length; i += batchSize) {
              const batch = mappingsToCreate.slice(i, i + batchSize);
              await replicaClient.columnMapping.createMany({
                data: batch,
                skipDuplicates: true,
              });

              // Only log first and last batch
              if (i === 0 || i + batchSize >= mappingsToCreate.length) {
                console.log(
                  `[ColumnMappingService] Created batch ${
                    Math.floor(i / batchSize) + 1
                  }/${Math.ceil(mappingsToCreate.length / batchSize)}`
                );
              }
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

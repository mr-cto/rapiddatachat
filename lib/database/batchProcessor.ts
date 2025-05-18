import { PrismaClient } from "@prisma/client";
import { getConnectionManager } from "./connectionManager";
import {
  getAccelerateConfig,
  isPrismaAccelerate,
} from "../prisma/accelerateConfig";

/**
 * Optimized batch processing for file data
 * Implements transaction-based batch inserts with proper error handling
 */
export class BatchProcessor {
  /**
   * Insert file data in optimized batches
   * @param fileId File ID
   * @param rows Data rows
   * @param batchSize Optional batch size (default: dynamically determined)
   * @returns Promise<void>
   */
  static async insertFileData(
    fileId: string,
    rows: Record<string, unknown>[],
    batchSize?: number
  ): Promise<void> {
    if (rows.length === 0) {
      console.log(`No data to insert for file ${fileId}`);
      return;
    }

    // Get connection manager
    const connectionManager = getConnectionManager();

    // Get Prisma Accelerate configuration
    const accelerateConfig = getAccelerateConfig();
    const isAccelerate = isPrismaAccelerate();

    // Dynamically adjust batch size based on total row count and Prisma Accelerate status
    if (!batchSize) {
      if (isAccelerate) {
        // For Prisma Accelerate, use smaller non-transactional batches to avoid timeouts
        if (rows.length > 500000) {
          batchSize = 200; // Very small batches for extremely large files
        } else if (rows.length > 100000) {
          batchSize = 500; // Small batches for large files
        } else if (rows.length > 10000) {
          batchSize = 1000; // Medium batches for medium files
        } else {
          batchSize = 2000; // Default batch size for small files
        }
        console.log(
          `[BatchProcessor] Using Prisma Accelerate optimized batch size: ${batchSize}`
        );
      } else {
        // For direct database connections, use larger transaction-based batches
        if (rows.length > 500000) {
          batchSize = 500; // Very small batches for extremely large files
        } else if (rows.length > 100000) {
          batchSize = 1000; // Small batches for large files
        } else {
          batchSize = 2000; // Default batch size for normal files
        }
      }
    }

    console.log(
      `Using batch size of ${batchSize} for file ${fileId} with ${rows.length} rows`
    );

    // Process in batches to reduce memory usage
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const currentBatchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(rows.length / batchSize);

      await BatchProcessor.processBatch(
        fileId,
        batch,
        currentBatchNumber,
        totalBatches
      );

      // Force garbage collection between batches if available
      if (typeof global.gc === "function") {
        try {
          global.gc();
        } catch (gcError) {
          console.warn("Failed to trigger garbage collection:", gcError);
        }
      }
    }
  }

  /**
   * Process a batch of rows using transaction
   * @param fileId File ID
   * @param batch Batch of rows to process
   * @param batchNumber Current batch number
   * @param totalBatches Total number of batches
   */
  private static async processBatch(
    fileId: string,
    batch: Record<string, unknown>[],
    batchNumber: number,
    totalBatches: number
  ): Promise<void> {
    // Get connection manager
    const connectionManager = getConnectionManager();

    // Prepare data for insertion
    const dataToInsert = batch.map((row) => ({
      fileId,
      // Handle circular references and BigInt values
      data: JSON.parse(
        JSON.stringify(row, (_, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      ),
    }));

    // Maximum number of retries
    const maxRetries = 3;
    let retryCount = 0;
    let success = false;

    while (!success && retryCount < maxRetries) {
      try {
        // Get a replica client from the pool
        const replicaClient = connectionManager.getReplicaClient();

        try {
          // Get Prisma Accelerate configuration
          const accelerateConfig = getAccelerateConfig();
          const isAccelerate = isPrismaAccelerate();

          // For Prisma Accelerate or small batches, always use non-transactional approach
          if (isAccelerate || dataToInsert.length <= 100) {
            // For Prisma Accelerate, avoid transactions due to timeout limitations
            console.log(
              `[BatchProcessor] Using non-transactional batch insert (${
                isAccelerate ? "Prisma Accelerate detected" : "Small batch"
              }, ${dataToInsert.length} rows)`
            );

            // For very large batches, split into smaller chunks to avoid memory issues
            if (dataToInsert.length > 500) {
              const chunkSize = 200;
              console.log(
                `[BatchProcessor] Splitting large non-transactional batch into chunks of ${chunkSize}`
              );

              for (let i = 0; i < dataToInsert.length; i += chunkSize) {
                const chunk = dataToInsert.slice(i, i + chunkSize);
                await replicaClient.fileData.createMany({
                  data: chunk,
                  skipDuplicates: true,
                });
                console.log(
                  `[BatchProcessor] Inserted chunk ${
                    Math.floor(i / chunkSize) + 1
                  }/${Math.ceil(dataToInsert.length / chunkSize)} (${
                    chunk.length
                  } rows)`
                );
              }
            } else {
              // For smaller batches, insert all at once
              await replicaClient.fileData.createMany({
                data: dataToInsert,
                skipDuplicates: true,
              });
            }
          } else {
            // For direct database connections, use transactions with appropriate timeouts
            await replicaClient.$transaction(
              async (tx) => {
                // Insert all rows in a single createMany operation
                await tx.fileData.createMany({
                  data: dataToInsert,
                  skipDuplicates: true,
                });
              },
              {
                timeout: accelerateConfig.timeout,
                maxWait: accelerateConfig.maxWait,
              }
            );
          }

          console.log(
            `Inserted batch ${batchNumber}/${totalBatches} (${dataToInsert.length} rows) for file ${fileId}`
          );
          success = true;
        } catch (txError) {
          // Handle transaction errors
          const errorMessage =
            txError instanceof Error ? txError.message : "Unknown error";

          // Check for specific error types
          const isTimeoutError =
            errorMessage.includes("maximum allowed execution time") ||
            errorMessage.includes("P6004") ||
            errorMessage.includes("Query did not produce a result") ||
            errorMessage.includes(
              "Interactive transactions running through Accelerate are limited"
            );

          const isPermissionError =
            errorMessage.includes("permission denied for schema") ||
            errorMessage.includes("42501");

          if (isTimeoutError) {
            // Timeout error - split the batch and try again
            if (batch.length > 50) {
              console.warn(
                `Transaction timeout on batch ${batchNumber}/${totalBatches}. Splitting batch.`
              );
              await BatchProcessor.handleBatchSplit(fileId, batch);
              success = true;
            } else {
              // For small batches that still timeout, try individual inserts
              console.warn(
                `Transaction timeout on small batch ${batchNumber}/${totalBatches}. Using individual inserts.`
              );
              await BatchProcessor.insertIndividually(
                fileId,
                batch,
                replicaClient
              );
              success = true;
            }
          } else if (isPermissionError) {
            // Permission error - try individual inserts with reduced privileges
            console.warn(
              `Permission error on batch ${batchNumber}/${totalBatches}. Using individual inserts with reduced privileges.`
            );
            await BatchProcessor.insertIndividually(
              fileId,
              batch,
              replicaClient
            );
            success = true;
          } else {
            // Other errors - retry with exponential backoff
            retryCount++;
            if (retryCount < maxRetries) {
              console.warn(
                `Error on batch ${batchNumber}/${totalBatches}: ${errorMessage}`
              );
              console.warn(
                `Retry ${retryCount}/${maxRetries} for batch ${batchNumber}/${totalBatches}`
              );
              // Exponential backoff
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1))
              );
            } else {
              // Max retries reached - split the batch
              console.error(
                `Error inserting batch for file ${fileId} after ${maxRetries} retries:`,
                txError
              );
              if (batch.length > 50) {
                await BatchProcessor.handleBatchSplit(fileId, batch);
                success = true;
              } else {
                // For small batches, try individual inserts
                await BatchProcessor.insertIndividually(
                  fileId,
                  batch,
                  replicaClient
                );
                success = true;
              }
            }
          }
        } finally {
          // Release the client back to the pool
          connectionManager.releaseReplicaClient(replicaClient);
        }
      } catch (error) {
        // Handle connection errors
        retryCount++;
        console.error(
          `Connection error on batch ${batchNumber}/${totalBatches}:`,
          error
        );

        if (retryCount < maxRetries) {
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1))
          );
        } else {
          throw new Error(
            `Failed to process batch after ${maxRetries} retries: ${error}`
          );
        }
      }
    }
  }

  /**
   * Split a batch into smaller chunks and process each chunk
   * @param fileId File ID
   * @param batch Batch of rows to split
   */
  private static async handleBatchSplit(
    fileId: string,
    batch: Record<string, unknown>[]
  ): Promise<void> {
    console.log(`Splitting batch of ${batch.length} rows into smaller chunks`);

    // Get Prisma Accelerate configuration
    const isAccelerate = isPrismaAccelerate();

    // Determine optimal split strategy based on batch size and Accelerate status
    let chunks: Record<string, unknown>[][] = [];

    if (isAccelerate) {
      // For Prisma Accelerate, use smaller chunks to avoid timeouts
      if (batch.length > 500) {
        // For large batches, split into 8 chunks
        const chunkSize = Math.ceil(batch.length / 8);
        for (let i = 0; i < batch.length; i += chunkSize) {
          chunks.push(batch.slice(i, i + chunkSize));
        }
      } else if (batch.length > 100) {
        // For medium batches, split into 4 chunks
        const chunkSize = Math.ceil(batch.length / 4);
        for (let i = 0; i < batch.length; i += chunkSize) {
          chunks.push(batch.slice(i, i + chunkSize));
        }
      } else {
        // For small batches, skip transaction entirely and use direct inserts
        console.log(
          `[BatchProcessor] Small batch (${batch.length} rows) with Prisma Accelerate - using direct inserts`
        );
        const replicaClient = getConnectionManager().getReplicaClient();
        try {
          await BatchProcessor.insertIndividually(fileId, batch, replicaClient);
          return; // Exit early since we've handled the batch
        } finally {
          getConnectionManager().releaseReplicaClient(replicaClient);
        }
      }
    } else {
      // For direct database connections, use standard quarter splitting
      const quarterSize = Math.ceil(batch.length / 4);
      chunks = [
        batch.slice(0, quarterSize),
        batch.slice(quarterSize, quarterSize * 2),
        batch.slice(quarterSize * 2, quarterSize * 3),
        batch.slice(quarterSize * 3),
      ];
    }

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.length > 0) {
        console.log(
          `Processing split chunk ${i + 1}/${chunks.length} (${
            chunk.length
          } rows)`
        );
        await BatchProcessor.insertFileData(
          fileId,
          chunk,
          Math.max(chunk.length, 25)
        );
      }
    }
  }

  /**
   * Insert rows individually as a fallback method
   * @param fileId File ID
   * @param rows Data rows
   * @param client Prisma client
   */
  private static async insertIndividually(
    fileId: string,
    rows: Record<string, unknown>[],
    client: PrismaClient
  ): Promise<void> {
    console.log(
      `[BatchProcessor] Optimized individual inserts for ${rows.length} rows`
    );

    let successCount = 0;
    let errorCount = 0;

    // Use mini-batches for better performance
    const miniBatchSize = 10;
    const totalMiniBatches = Math.ceil(rows.length / miniBatchSize);

    for (let i = 0; i < rows.length; i += miniBatchSize) {
      const miniBatch = rows.slice(i, i + miniBatchSize);
      const currentBatch = Math.floor(i / miniBatchSize) + 1;

      try {
        // Prepare data with proper JSON handling
        const dataToInsert = miniBatch.map((row) => ({
          fileId,
          data: JSON.parse(
            JSON.stringify(row, (_, value) =>
              typeof value === "bigint" ? value.toString() : value
            )
          ),
        }));

        // Try mini-batch insert first
        try {
          await client.fileData.createMany({
            data: dataToInsert,
            skipDuplicates: true,
          });

          // If successful, count all rows as successful
          successCount += miniBatch.length;

          // Log progress
          console.log(
            `[BatchProcessor] Inserted mini-batch ${currentBatch}/${totalMiniBatches} (${miniBatch.length} rows)`
          );
        } catch (batchError) {
          // If mini-batch fails, fall back to truly individual inserts
          console.log(
            `[BatchProcessor] Mini-batch ${currentBatch} failed, falling back to truly individual inserts`
          );

          for (const row of miniBatch) {
            try {
              // Prepare data with proper JSON handling
              const data = {
                fileId,
                data: JSON.parse(
                  JSON.stringify(row, (_, value) =>
                    typeof value === "bigint" ? value.toString() : value
                  )
                ),
              };

              // Insert individual row
              await client.fileData.create({ data });
              successCount++;
            } catch (rowError) {
              if (
                rowError instanceof Error &&
                rowError.message.includes("Unique constraint failed")
              ) {
                // Skip duplicates silently
                successCount++;
              } else {
                errorCount++;
              }
            }
          }
        }
      } catch (error) {
        // Count all rows in this mini-batch as errors
        errorCount += miniBatch.length;
        console.warn(
          `[BatchProcessor] Error processing mini-batch ${currentBatch}: ${error}`
        );
      }

      // Log overall progress periodically
      if (currentBatch % 5 === 0 || currentBatch === totalMiniBatches) {
        console.log(
          `[BatchProcessor] Progress: ${successCount} succeeded, ${errorCount} failed (${Math.round(
            ((successCount + errorCount) / rows.length) * 100
          )}%)`
        );
      }
    }

    console.log(
      `[BatchProcessor] Individual inserts complete: ${successCount} succeeded, ${errorCount} failed`
    );
  }
}

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

    // Determine optimal batch size based on total rows
    if (!batchSize) {
      // Scale batch size based on total rows for better performance
      if (rows.length > 500000) {
        // For extremely large files (500k+ rows)
        batchSize = 10000;
      } else if (rows.length > 100000) {
        // For very large files (100k-500k rows)
        batchSize = 5000;
      } else if (rows.length > 5000) {
        // For large files (10k-100k rows)
        batchSize = 2500;
      } else {
        // For smaller files
        batchSize = 1000;
      }
    }

    // Only log once at the beginning of the process
    console.log(
      `Processing ${rows.length} rows for file ${fileId} with batch size ${batchSize}`
    );

    // Process in batches to reduce memory usage
    const totalBatches = Math.ceil(rows.length / batchSize);

    // Log only at the start
    console.log(`Starting batch processing: ${totalBatches} batches total`);

    // Process batches with minimal logging
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const currentBatchNumber = Math.floor(i / batchSize) + 1;

      // Only log at significant milestones (start, every 10%, end)
      const isSignificantBatch =
        currentBatchNumber === 1 ||
        currentBatchNumber === totalBatches ||
        currentBatchNumber % Math.max(1, Math.floor(totalBatches / 10)) === 0;

      if (isSignificantBatch) {
        const percentComplete = Math.round(
          (currentBatchNumber / totalBatches) * 100
        );
        console.log(
          `Processing batch ${currentBatchNumber}/${totalBatches} (${percentComplete}% complete)`
        );
      }

      await BatchProcessor.processBatch(
        fileId,
        batch,
        currentBatchNumber,
        totalBatches,
        isSignificantBatch
      );

      // Force garbage collection between batches if available
      if (typeof global.gc === "function" && isSignificantBatch) {
        try {
          global.gc();
        } catch (gcError) {
          console.warn("Failed to trigger garbage collection:", gcError);
        }
      }
    }

    // Log completion
    console.log(
      `Completed processing ${rows.length} rows in ${totalBatches} batches`
    );
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
    totalBatches: number,
    shouldLog: boolean = false
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
            // Use a simpler approach for all batch sizes
            await replicaClient.fileData.createMany({
              data: dataToInsert,
              skipDuplicates: true,
            });
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

          // Only log if this is a significant batch
          if (shouldLog) {
            console.log(
              `Inserted batch ${batchNumber}/${totalBatches} (${dataToInsert.length} rows)`
            );
          }
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
    // Only log for large batches
    if (batch.length > 5000) {
      console.log(
        `Splitting large batch of ${batch.length} rows into smaller chunks`
      );
    }

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
        // Only log for the first and last chunks of large batches
        if ((i === 0 || i === chunks.length - 1) && chunks.length > 4) {
          console.log(
            `Processing split chunk ${i + 1}/${chunks.length} (${
              chunk.length
            } rows)`
          );
        }
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
    // Only log for significant individual inserts
    if (rows.length > 500) {
      console.log(
        `[BatchProcessor] Processing ${rows.length} rows individually`
      );
    }

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

          // Only log for significant milestones
          if (
            currentBatch === 1 ||
            currentBatch === totalMiniBatches ||
            currentBatch % 20 === 0
          ) {
            console.log(
              `[BatchProcessor] Inserted mini-batch ${currentBatch}/${totalMiniBatches}`
            );
          }
        } catch (batchError) {
          // If mini-batch fails, fall back to truly individual inserts
          console.warn(
            `[BatchProcessor] Mini-batch ${currentBatch} failed, using individual inserts`
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

      // Only log at the end
      if (currentBatch === totalMiniBatches) {
        console.log(
          `[BatchProcessor] Progress: 100% complete (${successCount} succeeded, ${errorCount} failed)`
        );
      }
    }

    // Only log if there were errors
    if (errorCount > 0) {
      console.log(
        `[BatchProcessor] Individual inserts complete: ${successCount} succeeded, ${errorCount} failed`
      );
    }
  }
}

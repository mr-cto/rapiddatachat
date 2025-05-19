import { executeQuery } from "./database";
import { isVercelEnvironment, cleanupTempFiles } from "./fileUtils";
import axios from "axios";
import { getConnectionManager } from "./database/connectionManager";
import { FileStatus } from "./fileIngestion";
import { BatchProcessor } from "./database/batchProcessor";
import logger from "./logging/logger";

// Create a logger for optimized file ingestion
const log = logger.createLogger("OptimizedFileIngestion");

// These imports will only be used on the server side
let stream: any;
let csvParse: any;
let csvTransform: any;
let fs: any;
let path: any;

// Only import Node.js modules on the server side
if (typeof window === "undefined") {
  // Server-side only imports
  stream = require("stream");

  // Import the csv-parse module for high-performance CSV parsing
  const csv = require("csv");
  csvParse = csv.parse;
  csvTransform = csv.transform;

  // Only import fs and path if not in Vercel environment
  if (!isVercelEnvironment) {
    fs = require("fs");
    path = require("path");
  }
}

/**
 * Process a large CSV file with optimized streaming and bulk loading
 * Designed specifically for high-performance with million-record files
 *
 * @param filePath Path to the CSV file
 * @param fileId File ID for database insertion
 * @param sourceId Source ID for provenance
 * @param onProgress Optional callback for progress updates
 * @param onHeadersExtracted Optional callback when headers are extracted
 * @returns Promise with processing result
 */
/**
 * Process a large CSV file with optimized streaming and bulk loading
 * Uses the high-performance 'csv' library with proper streaming
 * Designed specifically for million-record files
 *
 * @param filePath Path to the CSV file
 * @param fileId File ID for database insertion
 * @param sourceId Source ID for provenance
 * @param onProgress Optional callback for progress updates
 * @param onHeadersExtracted Optional callback when headers are extracted
 * @returns Promise with processing result
 */
export async function processLargeCSV(
  filePath: string,
  fileId: string,
  sourceId: string,
  onProgress?: (processed: number) => void,
  onHeadersExtracted?: (headers: string[]) => Promise<void>
): Promise<{ headers: string[]; rowCount: number }> {
  return new Promise(async (resolve, reject) => {
    try {
      log.info(`Starting optimized processing for large file: ${fileId}`);

      // For Vercel Blob Storage URLs, download the file first
      let fileStream;
      let tempFilePath = "";

      if (filePath.startsWith("http")) {
        try {
          log.info(`Downloading file from URL: ${filePath}`);
          const response = await axios({
            method: "GET",
            url: filePath,
            responseType: "stream",
          });

          // Create a pass-through stream
          const passThrough = new stream.PassThrough();
          response.data.pipe(passThrough);
          fileStream = passThrough;
        } catch (downloadError) {
          log.error(`Error downloading file from URL: ${downloadError}`);
          reject(downloadError);
          return;
        }
      } else {
        // Local file - only use fs if not in Vercel environment
        if (isVercelEnvironment) {
          // In Vercel, all files should be URLs
          log.error(
            `In Vercel environment, all files should be URLs: ${filePath}`
          );
          reject(new Error("In Vercel environment, all files should be URLs"));
          return;
        } else {
          fileStream = fs.createReadStream(filePath, {
            highWaterMark: 1024 * 1024, // 1MB buffer for better performance
          });
        }
      }

      // Track headers and rows
      let headers: string[] = [];
      let rowCount = 0;
      let totalBatches = 0;
      let currentBatch = 0;
      const timestamp = new Date().toISOString();

      // Determine optimal batch size based on estimated file size
      let optimalBatchSize = 10000; // Default for very large files

      // Handle headers extraction
      let headersExtracted = false;

      // Create a transform stream to extract headers
      const headerExtractorStream = csvTransform(
        (record: Record<string, unknown>, callback: Function) => {
          // If this is the first row, extract headers
          if (!headersExtracted) {
            headers = Object.keys(record);
            headersExtracted = true;
            log.info(`Extracted ${headers.length} headers from CSV`);

            // Call the headers extracted callback if provided
            if (onHeadersExtracted) {
              onHeadersExtracted(headers)
                .then(() => {
                  log.info("CSV headers processed and stored successfully");
                })
                .catch((headerError) => {
                  log.error("Error processing CSV headers:", headerError);
                  // Continue even if header processing fails
                });
            }
          }

          // Pass the record through unchanged
          callback(null, record);
        }
      );

      // Create a transform stream for batching using the csv-transform library
      // This is more efficient than a custom transform stream
      let batchRows: Record<string, unknown>[] = [];

      // Create a transform stream using the csv-transform library
      const batchingStream = csvTransform(
        // Transform function that collects records into batches
        (record: Record<string, unknown>, callback: Function) => {
          // Add provenance columns
          const recordWithProvenance = {
            ...record,
            source_id: sourceId,
            ingested_at: timestamp,
          };

          // Add to batch
          batchRows.push(recordWithProvenance);
          rowCount++;

          // Report progress at regular intervals
          if (rowCount % 10000 === 0 && onProgress) {
            onProgress(rowCount);
          }

          // If we've collected enough rows for a batch, process it
          if (batchRows.length >= optimalBatchSize) {
            const batchToProcess = [...batchRows];
            batchRows = [];
            currentBatch++;

            // Only log at significant milestones
            if (currentBatch % 5 === 0 || currentBatch === 1) {
              log.info(
                `Processing batch ${currentBatch} with ${batchToProcess.length} rows`
              );
            }

            // Process the batch
            BatchProcessor.insertFileData(
              fileId,
              batchToProcess,
              optimalBatchSize
            )
              .then(() => {
                callback();
              })
              .catch((error) => {
                log.error(`Error processing batch ${currentBatch}:`, error);
                callback(error);
              });
          } else {
            // Not enough rows for a batch yet, just continue
            callback();
          }
        },
        // Flush function to process any remaining rows
        {
          parallel: 1, // Process one record at a time
          consume: true, // Consume the stream
          flush: (callback: Function) => {
            if (batchRows.length > 0) {
              currentBatch++;
              log.info(
                `Processing final batch ${currentBatch} with ${batchRows.length} rows`
              );

              BatchProcessor.insertFileData(fileId, batchRows, optimalBatchSize)
                .then(() => {
                  callback();
                })
                .catch((error) => {
                  log.error(`Error processing final batch:`, error);
                  callback(error);
                });
            } else {
              callback();
            }
          },
        }
      );

      // Create a final stream to handle the output
      const finalStream = new stream.Writable({
        objectMode: true,
        write(data: any, encoding: string, callback: Function) {
          // Just acknowledge the data
          callback();
        },
      });

      // Set up the pipeline with csv-parse for optimal performance
      fileStream
        .pipe(
          csvParse({
            columns: true, // Auto-detect columns from the first line
            skip_empty_lines: true,
            trim: true,
            bom: true, // Handle BOM characters
            cast: true, // Auto-cast values when possible
            highWaterMark: 64 * 1024, // 64KB chunks for better performance
          })
        )
        .pipe(headerExtractorStream)
        .pipe(batchingStream)
        .pipe(finalStream)
        .on("finish", () => {
          log.info(
            `CSV processing complete. Processed ${rowCount} rows with ${headers.length} columns.`
          );

          // Clean up temp file or blob if needed
          if (tempFilePath.length > 0) {
            try {
              if (isVercelEnvironment && tempFilePath.startsWith("http")) {
                // For Vercel Blob Storage URLs, use the cleanupTempFiles utility
                cleanupTempFiles([tempFilePath])
                  .then(() =>
                    log.info(`Cleaned up Vercel Blob: ${tempFilePath}`)
                  )
                  .catch((err) =>
                    log.warn(`Failed to clean up Vercel Blob: ${err}`)
                  );
              } else if (!isVercelEnvironment && fs) {
                // For local files, use fs
                fs.unlinkSync(tempFilePath);
                log.info(`Temporary file deleted: ${tempFilePath}`);
              }
            } catch (cleanupError) {
              log.warn(`Failed to delete temporary file: ${cleanupError}`);
            }
          }

          resolve({ headers, rowCount });
        })
        .on("error", (error: Error) => {
          log.error("Error in CSV processing pipeline:", error);
          reject(error);
        });
    } catch (error) {
      log.error("Error in optimized CSV processing:", error);
      reject(error);
    }
  });
}

/**
 * Update file status in the database with optimized connection handling
 * @param fileId File ID
 * @param status New status
 * @returns Promise<boolean> Success
 */
export async function updateFileStatus(
  fileId: string,
  status: FileStatus
): Promise<boolean> {
  try {
    const connectionManager = getConnectionManager();
    const replicaClient = connectionManager.getReplicaClient();

    try {
      await replicaClient.file.update({
        where: { id: fileId },
        data: { status },
      });

      // Only log status changes to active or error
      if (status === FileStatus.ACTIVE || status === FileStatus.ERROR) {
        log.info(`Updated file ${fileId} status to ${status}`);
      }

      return true;
    } finally {
      // Release the client back to the pool
      connectionManager.releaseReplicaClient(replicaClient);
    }
  } catch (error) {
    log.error(`Error updating file status: ${error}`);
    return false;
  }
}

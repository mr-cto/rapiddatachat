import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import {
  executeQuery,
  createFileTable,
  insertFileData,
} from "../../../lib/database";
import { FileStatus, processFileStreaming } from "../../../lib/fileIngestion";
import {
  processLargeCSV,
  updateFileStatus,
} from "../../../lib/fastFileIngestion";
import {
  UPLOADS_DIR,
  isVercelEnvironment,
  cleanupTempFiles,
} from "../../../lib/fileUtils";
import {
  handleFileError,
  ErrorType,
  ErrorSeverity,
  retryWithBackoff,
  addToDeadLetterQueue,
} from "../../../lib/errorHandling";
import { withAuth } from "../../../lib/middleware/authMiddleware";
import logger from "../../../lib/logging/logger";

// Create a logger for file ingestion
const log = logger.createLogger("FileIngestion");

// Handler with authentication middleware
export default withAuth(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let fileId: string = "";
  let dbOperationsSkipped = false;
  let filePath: string = "";

  try {
    fileId = req.body.fileId;

    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    // Get column merges and visible columns information if provided
    const columnMerges = req.body.columnMerges || null;
    const visibleColumns = req.body.visibleColumns || null;

    if (columnMerges) {
      log.info(`Column merges provided for file ${fileId}`);
    }

    if (visibleColumns) {
      log.info(`Visible columns provided for file ${fileId}`);
    }

    log.info(`Starting ingestion process for file ${fileId}`);

    // Get file information from database
    let file: Record<string, unknown> | null = null;
    let sourceId: string = "";
    let filePath: string = "";
    let format: string = "";

    try {
      const fileResult = (await executeQuery(`
        SELECT * FROM files WHERE id = '${fileId}'
      `)) as Array<Record<string, unknown>>;

      if (!fileResult || fileResult.length === 0) {
        return res.status(404).json({ error: "File not found" });
      }

      file = fileResult[0];

      // Get the source ID from the sources table
      const sourceResult = (await executeQuery(`
        SELECT id FROM sources WHERE file_id = '${fileId}'
      `)) as Array<Record<string, unknown>>;

      if (sourceResult && sourceResult.length > 0) {
        sourceId = sourceResult[0].id as string;
      } else {
        // If no source found, use the file ID as a fallback
        sourceId = fileId;
      }

      // Handle file path based on environment
      filePath = file.filepath as string;

      // If it's a local path in development, ensure it's properly joined
      if (!isVercelEnvironment && !filePath.startsWith("http")) {
        filePath = path.join(UPLOADS_DIR, path.basename(filePath || ""));
      }
      format = file.format as string;
    } catch (dbError) {
      // Check if this is a DuckDB server environment error
      if (
        dbError instanceof Error &&
        (dbError.message.includes(
          "DuckDB is only available in browser environments"
        ) ||
          dbError.message.includes("Worker is not defined") ||
          dbError.message === "DuckDB is not available in server environments")
      ) {
        console.warn(
          "DuckDB operation skipped (server environment): Unable to retrieve file information from database"
        );
        dbOperationsSkipped = true;

        // Try to get file information from request body or fallback to defaults
        sourceId = req.body.sourceId || fileId;

        // Use the filepath directly if it's a URL (Vercel Blob)
        if (req.body.filepath && req.body.filepath.startsWith("http")) {
          filePath = req.body.filepath;
        } else {
          filePath = path.join(
            UPLOADS_DIR,
            req.body.filename || `${fileId}.unknown`
          );
        }
        format = req.body.format || "csv";
      } else {
        throw dbError;
      }
    }

    // Check if file exists (only for local files, not for URLs)
    if (!filePath.startsWith("http") && !fs.existsSync(filePath)) {
      await handleFileError(
        fileId,
        ErrorType.VALIDATION,
        ErrorSeverity.HIGH,
        "File not found on disk",
        { filePath }
      );
      return res.status(404).json({ error: "File not found on disk" });
    }

    // Update file status to processing
    await updateFileStatus(fileId, FileStatus.PROCESSING);
    log.info(`Updated file status to ${FileStatus.PROCESSING}`);

    // Process the file with optimized streaming for large files
    log.info(`Starting file processing for ${fileId} using optimized approach`);

    // Store for extracted headers
    let extractedHeaders: string[] = [];

    // Create file table with the extracted headers
    try {
      // Pass the headers to createFileTable to ensure the table is created properly
      await createFileTable(
        fileId,
        extractedHeaders.length > 0 ? extractedHeaders : []
      );
      log.info(`Created or verified database table for file ${fileId}`);
    } catch (error) {
      await handleFileError(
        fileId,
        ErrorType.DATABASE,
        ErrorSeverity.HIGH,
        `Error creating table: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { error }
      );
      throw error;
    }

    // Process the file with streaming and batch insertion
    // This will parse the file and insert data in batches without loading everything into memory
    // Check if this file is already being processed to prevent duplicate processing
    try {
      const fileStatusQuery = await executeQuery(`
        SELECT status, metadata FROM files WHERE id = '${fileId}'
      `);

      if (
        fileStatusQuery &&
        Array.isArray(fileStatusQuery) &&
        fileStatusQuery.length > 0
      ) {
        const currentStatus = fileStatusQuery[0].status;
        const metadata = fileStatusQuery[0].metadata || {};

        // Check if the file has been processed before by looking at ingestedAt or status
        if (currentStatus === "active") {
          log.warn(
            `File ${fileId} is already active. Checking if it has data...`
          );

          // Check if the file has data
          const dataCountResult = await executeQuery(`
            SELECT COUNT(*) as count FROM file_data WHERE file_id = '${fileId}'
          `);

          const dataCount =
            Array.isArray(dataCountResult) && dataCountResult.length > 0
              ? (dataCountResult[0] as any).count
              : 0;

          if (dataCount > 0) {
            log.info(
              `File ${fileId} is already active with ${dataCount} rows. Skipping processing.`
            );
            return res.status(200).json({
              success: true,
              fileId,
              message: "File is already active with data. Skipping processing.",
              alreadyProcessing: false,
              alreadyActive: true,
              rowCount: dataCount,
            });
          } else {
            log.warn(
              `File ${fileId} is marked as active but has no data. Proceeding with processing.`
            );
          }
        } else if (currentStatus === "processing") {
          // Check if the processing lock is stale (more than 10 minutes old)
          const processingLock = metadata.processingLock;
          if (processingLock && typeof processingLock === "string") {
            const lockTime = new Date(processingLock).getTime();
            const currentTime = new Date().getTime();
            const lockAgeMinutes = (currentTime - lockTime) / (1000 * 60);

            if (lockAgeMinutes > 10) {
              log.warn(
                `File ${fileId} has a stale processing lock (${lockAgeMinutes.toFixed(
                  2
                )} minutes old). Proceeding with processing.`
              );
            } else {
              log.warn(
                `File ${fileId} is currently being processed (lock age: ${lockAgeMinutes.toFixed(
                  2
                )} minutes). Skipping duplicate processing.`
              );
              return res.status(200).json({
                success: true,
                fileId,
                message:
                  "File is currently being processed. Skipping duplicate processing.",
                alreadyProcessing: true,
              });
            }
          }
        }
      }
    } catch (statusError) {
      log.warn(
        `Error checking file status: ${statusError}. Continuing with processing.`
      );
    }

    // Add a processing lock to prevent duplicate processing
    try {
      await executeQuery(`
        UPDATE files
        SET metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{processingLock}',
          '"${new Date().toISOString()}"'::jsonb
        )
        WHERE id = '${fileId}'
      `);
      log.info(`Added processing lock to file ${fileId}`);
    } catch (lockError) {
      log.warn(
        `Error adding processing lock: ${lockError}. Continuing anyway.`
      );
    }

    // Use fileId as the operationId to prevent duplicate processing
    const processResult = await retryWithBackoff(
      async () => {
        try {
          // Dynamically determine batch size based on file size
          // For very large files, use smaller batches to avoid timeouts
          let batchSize = 5000; // Reduced default batch size from 10000 to 5000

          // If file size is available, adjust batch size accordingly
          if (file && typeof file.size_bytes === "number") {
            const fileSizeBytes = file.size_bytes as number;
            const fileSizeMB = Math.round(fileSizeBytes / (1024 * 1024));

            // More granular batch size determination based on file size
            if (fileSizeBytes > 200 * 1024 * 1024) {
              // > 200MB - Very large files
              batchSize = 250;
              log.info(
                `Very large file detected (${fileSizeMB}MB), using batch size: ${batchSize}`
              );
            } else if (fileSizeBytes > 100 * 1024 * 1024) {
              // > 100MB - Large files
              batchSize = 500;
              log.info(
                `Large file detected (${fileSizeMB}MB), using batch size: ${batchSize}`
              );
            } else if (fileSizeBytes > 50 * 1024 * 1024) {
              // > 50MB - Medium-large files
              batchSize = 1000;
              log.info(
                `Medium-large file detected (${fileSizeMB}MB), using batch size: ${batchSize}`
              );
            } else if (fileSizeBytes > 10 * 1024 * 1024) {
              // > 10MB - Medium files
              batchSize = 2000;
              log.info(
                `Medium file detected (${fileSizeMB}MB), using batch size: ${batchSize}`
              );
            } else {
              // Small files
              batchSize = 3000;
              log.info(
                `Small file detected (${fileSizeMB}MB), using batch size: ${batchSize}`
              );
            }

            // Special case for files with exactly 10,000 rows (common issue)
            if (fileSizeBytes > 0 && fileSizeBytes < 2 * 1024 * 1024) {
              // For very small files that might have exactly 10,000 rows
              batchSize = 2500; // Use a non-round number to avoid edge cases
              log.info(
                `Small file that might have exactly 10,000 rows, using adjusted batch size: ${batchSize}`
              );
            }
          }

          // Track progress with more detailed updates
          let lastProgressUpdate = 0;
          let startTime = Date.now();
          let lastUpdateTime = startTime;

          // Dynamically adjust update interval based on file size
          // For very large files, we want more frequent updates
          let updateProgressInterval = 10000; // Default: update every 10,000 rows

          // Get file size from the file object
          const fileSizeMB =
            file && typeof file.size_bytes === "number"
              ? Math.round((file.size_bytes as number) / (1024 * 1024))
              : 0;

          if (fileSizeMB > 200) {
            // For extremely large files, update more frequently
            updateProgressInterval = 1000; // Every 1,000 rows
          } else if (fileSizeMB > 100) {
            // For very large files
            updateProgressInterval = 2000; // Every 2,000 rows
          } else if (fileSizeMB > 50) {
            // For large files
            updateProgressInterval = 5000; // Every 5,000 rows
          }

          // Store progress in file metadata for UI to access
          const updateFileProgress = async (
            processed: number,
            total: number = 0
          ) => {
            try {
              // Calculate percentage if we have a total estimate
              const percentage =
                total > 0
                  ? Math.min(Math.round((processed / total) * 100), 99)
                  : null;

              // Calculate processing rate and ETA
              const currentTime = Date.now();
              const elapsedSeconds = (currentTime - startTime) / 1000;
              const rowsPerSecond = processed / elapsedSeconds;

              // Only calculate ETA if we have a total estimate and have processed some rows
              let eta = null;
              if (total > 0 && rowsPerSecond > 0) {
                const remainingRows = total - processed;
                eta = Math.round(remainingRows / rowsPerSecond);
              }

              // Build progress metadata
              const progressData = {
                processed,
                total: total > 0 ? total : null,
                percentage,
                rowsPerSecond: Math.round(rowsPerSecond * 100) / 100,
                elapsedSeconds: Math.round(elapsedSeconds),
                eta,
                lastUpdated: new Date().toISOString(),
              };

              // Update file metadata with progress information
              await executeQuery(`
              UPDATE files
              SET metadata =
                CASE
                  WHEN metadata IS NULL THEN
                    jsonb_build_object('ingestion_progress', '${JSON.stringify(
                      progressData
                    )}'::jsonb)
                  ELSE
                    jsonb_set(
                      COALESCE(metadata, '{}'::jsonb),
                      '{ingestion_progress}',
                      '${JSON.stringify(progressData)}'::jsonb
                    )
                END
              WHERE id = '${fileId}'
            `);
            } catch (error) {
              // Don't fail the process if metadata update fails
              console.warn(`Failed to update progress metadata: ${error}`);
            }
          };

          const onProgress = (processed: number) => {
            // Update progress at regular intervals
            if (processed - lastProgressUpdate >= updateProgressInterval) {
              // Only log at significant milestones to reduce noise
              if (
                processed % 5000 === 0 ||
                processed === lastProgressUpdate + updateProgressInterval
              ) {
                log.info(`Processed ${processed} rows from ${fileId}`);
              }

              // Calculate processing rate
              const currentTime = Date.now();
              const timeSinceLastUpdate = (currentTime - lastUpdateTime) / 1000;
              const rowsSinceLastUpdate = processed - lastProgressUpdate;
              const currentRate = rowsSinceLastUpdate / timeSinceLastUpdate;

              log.debug(
                `Current processing rate: ${Math.round(
                  currentRate
                )} rows/second`
              );

              // Estimate total rows based on file size (very rough estimate)
              // Assume average of 100 bytes per row for CSV files
              const fileSizeBytes =
                file && typeof file.size_bytes === "number"
                  ? (file.size_bytes as number)
                  : 0;
              const estimatedTotalRows =
                fileSizeBytes > 0 ? Math.round(fileSizeBytes / 100) : 0;

              // Update file metadata with progress information
              updateFileProgress(processed, estimatedTotalRows);

              // Update tracking variables
              lastProgressUpdate = processed;
              lastUpdateTime = currentTime;
            }
          };

          // Callback for when headers are extracted
          const onHeadersExtracted = async (
            headers: string[]
          ): Promise<void> => {
            log.info(`Extracted ${headers.length} columns from file ${fileId}`);
            log.debug("Extracted headers", headers);
            extractedHeaders = headers;

            // Store headers in file metadata for schema management
            try {
              // Store the headers as a proper JSONB array, not as a JSON string
              await executeQuery(`
              UPDATE files
              SET metadata =
                CASE
                  WHEN metadata IS NULL THEN
                    jsonb_build_object('columns', jsonb_build_array(${headers
                      .map((h) => `'${h.replace(/'/g, "''")}'`)
                      .join(", ")}))
                  ELSE
                    jsonb_set(
                      COALESCE(metadata, '{}'::jsonb),
                      '{columns}',
                      jsonb_build_array(${headers
                        .map((h) => `'${h.replace(/'/g, "''")}'`)
                        .join(", ")})
                    )
                END
              WHERE id = '${fileId}'
            `);

              // If column merges were provided, store them in metadata
              if (columnMerges) {
                await executeQuery(`
                UPDATE files
                SET metadata = jsonb_set(
                  COALESCE(metadata, '{}'::jsonb),
                  '{column_merges}',
                  '${JSON.stringify(columnMerges)}'::jsonb
                )
                WHERE id = '${fileId}'
              `);
                log.info(`Stored column merges in file metadata for ${fileId}`);
              }

              // If visible columns were provided, store them in metadata
              if (visibleColumns) {
                await executeQuery(`
                UPDATE files
                SET metadata = jsonb_set(
                  COALESCE(metadata, '{}'::jsonb),
                  '{visible_columns}',
                  '${JSON.stringify(visibleColumns)}'::jsonb
                )
                WHERE id = '${fileId}'
              `);
                log.info(
                  `Stored visible columns in file metadata for ${fileId}`
                );
              }
              log.info(`Stored column headers in file metadata for ${fileId}`);

              // Update file status to indicate headers are available
              // This allows the UI to show the columns before ingestion is complete
              await updateFileStatus(fileId, FileStatus.HEADERS_EXTRACTED);
              log.info(`Updated file status to indicate headers are available`);
            } catch (metadataError) {
              console.warn(
                `Failed to store column headers in metadata: ${metadataError}`
              );
              // Don't fail the process if metadata update fails
            }
          };

          // Use the appropriate processor based on file format
          const formatLower = format.toLowerCase();

          if (formatLower === "csv") {
            // Use the optimized implementation for CSV files
            log.info(
              `Using optimized large file processor for CSV file ${fileId}`
            );
            return await processLargeCSV(
              filePath,
              fileId,
              sourceId,
              onProgress,
              onHeadersExtracted
            );
          } else if (formatLower === "xlsx" || formatLower === "xls") {
            // Use the standard implementation for Excel files, but with explicit logging
            log.info(
              `Using standard file processor for Excel file ${fileId} (format: ${format})`
            );

            // Add additional debug logging for XLSX processing
            const xlsxDebugProgress = (processed: number) => {
              // Call the original progress handler
              onProgress(processed);

              // Add extra debug logging for Excel files
              if (processed % 100 === 0) {
                log.debug(`XLSX processing progress: ${processed} rows`);
              }
            };

            // Add additional debug for headers extraction
            const xlsxDebugHeaders = async (
              headers: string[]
            ): Promise<void> => {
              log.debug(`XLSX headers extracted: ${headers.join(", ")}`);
              return onHeadersExtracted(headers);
            };

            return await processFileStreaming(
              filePath,
              fileId,
              sourceId,
              format,
              batchSize,
              xlsxDebugProgress,
              xlsxDebugHeaders
            );
          } else {
            // Fall back to the standard implementation for other file types
            log.info(
              `Using standard file processor for ${format} file ${fileId}`
            );
            return await processFileStreaming(
              filePath,
              fileId,
              sourceId,
              format,
              batchSize,
              onProgress,
              onHeadersExtracted
            );
          }
        } catch (error) {
          await handleFileError(
            fileId!,
            ErrorType.PARSING,
            ErrorSeverity.MEDIUM,
            `Error processing file: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
            { format, error }
          );
          throw error;
        }
      },
      3, // maxRetries
      100, // baseDelay
      fileId // Use fileId as operationId for idempotency
    );

    log.info(
      `Successfully processed ${processResult.rowCount} rows from ${fileId}`
    );

    // First update the file status to active
    await updateFileStatus(fileId, FileStatus.ACTIVE);
    log.info(`Updated file status to ${FileStatus.ACTIVE}`);

    // Remove the processing lock
    try {
      await executeQuery(`
        UPDATE files
        SET metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{processingLock}',
          'null'::jsonb
        )
        WHERE id = '${fileId}'
      `);
      log.info(`Removed processing lock from file ${fileId}`);
    } catch (lockError) {
      log.warn(
        `Error removing processing lock: ${lockError}. Continuing anyway.`
      );
    }

    // Add a small delay to ensure data is fully committed before activation
    log.info(
      `Waiting for data to be fully committed before activating file...`
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check if file data was actually inserted (for logging purposes only)
    try {
      const dataCountResult = await executeQuery(`
        SELECT COUNT(*) as count FROM file_data WHERE file_id = '${fileId}'
      `);

      const dataCount =
        Array.isArray(dataCountResult) && dataCountResult.length > 0
          ? (dataCountResult[0] as any).count
          : 0;

      log.info(`File ${fileId} has ${dataCount} rows in the file_data table`);

      // If no data was inserted, log a warning but don't attempt reprocessing
      if (dataCount === 0) {
        log.warn(
          `No data was inserted for file ${fileId}. Please check the logs for errors and try uploading again if needed.`
        );
      }
    } catch (countError) {
      log.warn(`Error checking data count: ${countError}`);
    }

    // Now properly activate the file using the fileActivation module
    // This will create the necessary views and make the data accessible
    try {
      const { activateFile } = await import("../../../lib/fileActivation");

      log.info(`Attempting to activate file ${fileId} for user ${userId}`);
      const activationResult = await activateFile(fileId, userId);

      if (!activationResult.success) {
        log.warn(`File activation failed: ${activationResult.message}`);
        log.info(
          `File is still marked as active but views may not be properly created`
        );
      } else {
        log.info(`File successfully activated: ${activationResult.message}`);
      }
    } catch (activationError) {
      log.error(
        `Error during file activation: ${
          activationError instanceof Error
            ? activationError.message
            : "Unknown error"
        }`
      );
      log.info(
        `File is still marked as active but views may not be properly created`
      );
    }

    // Update ingested_at timestamp
    try {
      await executeQuery(`
        UPDATE files
        SET ingested_at = CURRENT_TIMESTAMP
        WHERE id = '${fileId}'
      `);
    } catch (dbError) {
      // Check if this is a DuckDB server environment error
      if (
        dbError instanceof Error &&
        (dbError.message.includes(
          "DuckDB is only available in browser environments"
        ) ||
          dbError.message.includes("Worker is not defined") ||
          dbError.message === "DuckDB is not available in server environments")
      ) {
        console.warn(
          "DuckDB operation skipped (server environment): Unable to update ingested_at timestamp"
        );
        dbOperationsSkipped = true;
      } else {
        throw dbError;
      }
    }

    // Clean up the file from Blob storage if it's a URL (Vercel environment)
    if (isVercelEnvironment && filePath.startsWith("http")) {
      try {
        log.info(`Cleaning up file from Blob storage: ${filePath}`);
        await cleanupTempFiles([filePath]);
        log.info(`Successfully cleaned up file from Blob storage`);
      } catch (cleanupError) {
        console.warn(
          `Warning: Failed to clean up file from Blob storage: ${cleanupError}`
        );
        // Don't fail the request if cleanup fails
      }
    }

    log.info(`Completed ingestion for file ${fileId}`);

    return res.status(200).json({
      success: true,
      fileId,
      rowCount: processResult.rowCount,
      columns: processResult.headers,
      columnMerges: columnMerges,
      visibleColumns: visibleColumns,
      dbOperationsSkipped,
      message: dbOperationsSkipped
        ? "File processed successfully, but database operations were skipped. The application may have limited functionality."
        : "File processed successfully.",
    });
  } catch (error) {
    console.error("File ingestion error:", error);

    // Clean up the file from Blob storage if it's a URL (Vercel environment)
    if (
      isVercelEnvironment &&
      typeof filePath === "string" &&
      filePath.startsWith("http")
    ) {
      try {
        log.info(`Cleaning up file from Blob storage after error: ${filePath}`);
        await cleanupTempFiles([filePath]);
        log.info(`Successfully cleaned up file from Blob storage after error`);
      } catch (cleanupError) {
        console.warn(
          `Warning: Failed to clean up file from Blob storage after error: ${cleanupError}`
        );
        // Don't fail the request if cleanup fails
      }
    }

    // Handle the error
    if (fileId) {
      await handleFileError(
        fileId,
        ErrorType.SYSTEM,
        ErrorSeverity.HIGH,
        `File ingestion failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { error }
      );

      // Update file status to error
      try {
        await updateFileStatus(fileId, FileStatus.ERROR);
      } catch (statusError) {
        console.error("Error updating file status:", statusError);
      }
    }

    return res.status(500).json({
      error: "File ingestion failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

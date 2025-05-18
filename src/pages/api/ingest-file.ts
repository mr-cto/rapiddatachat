import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import fs from "fs";
import path from "path";
import {
  executeQuery,
  createFileTable,
  insertFileData,
} from "../../../lib/database";
import {
  updateFileStatus,
  FileStatus,
  processFileStreaming,
} from "../../../lib/fileIngestion";
// Remove parquet conversion import as we're not using it anymore
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

// Enable debug logging
const DEBUG = process.env.DEBUG === "true";

// Log debug message if debug mode is enabled
function logDebug(message: string, data?: unknown): void {
  if (DEBUG) {
    console.log(`[DEBUG] ${message}`);
    if (data) {
      console.log("[DEBUG] Data:", data);
    }
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check authentication
  const session = await getServerSession(req, res, authOptions);

  // In development, allow requests without authentication for testing
  const isDevelopment = process.env.NODE_ENV === "development";
  if ((!session || !session.user) && !isDevelopment) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let fileId: string = "";
  let dbOperationsSkipped = false;
  let filePath: string = "";

  try {
    fileId = req.body.fileId;

    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    logDebug(`Starting ingestion process for file ${fileId}`);

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
    logDebug(`Updated file status to ${FileStatus.PROCESSING}`);

    // Process the file with streaming and batch processing
    logDebug(`Starting file processing for ${fileId} using streaming approach`);

    // Store for extracted headers
    let extractedHeaders: string[] = [];

    // Create file table (this is now a no-op in the database.ts implementation)
    try {
      await createFileTable(fileId, []);
      logDebug(`Created database table for file ${fileId}`);
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
    const processResult = await retryWithBackoff(async () => {
      try {
        // Dynamically determine batch size based on file size
        // For very large files, use smaller batches to avoid timeouts
        let batchSize = 10000; // Default batch size

        // If file size is available, adjust batch size accordingly
        if (file && typeof file.size_bytes === "number") {
          const fileSizeBytes = file.size_bytes as number;

          // Rough estimation: 1MB ~ 10,000 rows for CSV files
          // Adjust batch size based on file size - automatically optimize for all file sizes
          // For files with millions of records, we need extremely small batches
          if (fileSizeBytes > 500 * 1024 * 1024) {
            // > 500MB - Massive files (likely millions of records)
            batchSize = 50; // Extremely small batches for massive files
            logDebug(
              `Massive file detected (${Math.round(
                fileSizeBytes / (1024 * 1024)
              )}MB), using highly optimized batch size: ${batchSize}`
            );
          } else if (fileSizeBytes > 200 * 1024 * 1024) {
            // > 200MB - Extremely large files
            batchSize = 75; // Very small batches for extremely large files
            logDebug(
              `Extremely large file detected (${Math.round(
                fileSizeBytes / (1024 * 1024)
              )}MB), using highly optimized batch size: ${batchSize}`
            );
          } else if (fileSizeBytes > 150 * 1024 * 1024) {
            // > 150MB - Very large files
            batchSize = 100; // Very small batches for very large files
            logDebug(
              `Very large file detected (${Math.round(
                fileSizeBytes / (1024 * 1024)
              )}MB), using optimized batch size: ${batchSize}`
            );
          } else if (fileSizeBytes > 100 * 1024 * 1024) {
            // > 100MB - Large files
            batchSize = 200; // Small batches for large files
            logDebug(
              `Large file detected (${Math.round(
                fileSizeBytes / (1024 * 1024)
              )}MB), using optimized batch size: ${batchSize}`
            );
          } else if (fileSizeBytes > 50 * 1024 * 1024) {
            // > 50MB - Medium-large files
            batchSize = 500; // Medium batches for medium-large files
            logDebug(
              `Medium-large file detected (${Math.round(
                fileSizeBytes / (1024 * 1024)
              )}MB), using optimized batch size: ${batchSize}`
            );
          } else if (fileSizeBytes > 10 * 1024 * 1024) {
            // > 10MB - Medium files
            batchSize = 1000; // Adjusted batch size for medium files
            logDebug(
              `Medium file detected (${Math.round(
                fileSizeBytes / (1024 * 1024)
              )}MB), using optimized batch size: ${batchSize}`
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
            logDebug(`Processed ${processed} rows from ${fileId}`);

            // Calculate processing rate
            const currentTime = Date.now();
            const timeSinceLastUpdate = (currentTime - lastUpdateTime) / 1000;
            const rowsSinceLastUpdate = processed - lastProgressUpdate;
            const currentRate = rowsSinceLastUpdate / timeSinceLastUpdate;

            logDebug(
              `Current processing rate: ${Math.round(currentRate)} rows/second`
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
        const onHeadersExtracted = async (headers: string[]): Promise<void> => {
          logDebug(`Extracted ${headers.length} columns from file ${fileId}`);
          console.log("EXTRACTED HEADERS:", headers);
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
            logDebug(`Stored column headers in file metadata for ${fileId}`);

            // Update file status to indicate headers are available
            // This allows the UI to show the columns before ingestion is complete
            await updateFileStatus(fileId, FileStatus.HEADERS_EXTRACTED);
            logDebug(`Updated file status to indicate headers are available`);
          } catch (metadataError) {
            console.warn(
              `Failed to store column headers in metadata: ${metadataError}`
            );
            // Don't fail the process if metadata update fails
          }
        };

        return await processFileStreaming(
          filePath,
          fileId,
          sourceId,
          format,
          batchSize,
          onProgress,
          onHeadersExtracted
        );
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
    });

    logDebug(
      `Successfully processed ${processResult.rowCount} rows from ${fileId}`
    );

    // Update file status to active
    await updateFileStatus(fileId, FileStatus.ACTIVE);
    logDebug(`Updated file status to ${FileStatus.ACTIVE}`);

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
        logDebug(`Cleaning up file from Blob storage: ${filePath}`);
        await cleanupTempFiles([filePath]);
        logDebug(`Successfully cleaned up file from Blob storage`);
      } catch (cleanupError) {
        console.warn(
          `Warning: Failed to clean up file from Blob storage: ${cleanupError}`
        );
        // Don't fail the request if cleanup fails
      }
    }

    logDebug(`Completed ingestion for file ${fileId}`);

    return res.status(200).json({
      success: true,
      fileId,
      rowCount: processResult.rowCount,
      columns: processResult.headers,
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
        logDebug(`Cleaning up file from Blob storage after error: ${filePath}`);
        await cleanupTempFiles([filePath]);
        logDebug(`Successfully cleaned up file from Blob storage after error`);
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
}

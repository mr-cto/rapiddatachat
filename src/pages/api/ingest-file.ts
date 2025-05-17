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
  parseFile,
  updateFileStatus,
  FileStatus,
  addProvenanceColumns,
} from "../../../lib/fileIngestion";
import { convertToParquet } from "../../../lib/parquetConversion";
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

  let fileId: string | null = null;
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

    // Parse the file with retry mechanism
    logDebug(`Starting file parsing for ${fileId}`);
    const parsedData = await retryWithBackoff(async () => {
      try {
        return await parseFile(filePath, format);
      } catch (error) {
        await handleFileError(
          fileId!,
          ErrorType.PARSING,
          ErrorSeverity.MEDIUM,
          `Error parsing file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          { format, error }
        );
        throw error;
      }
    });
    logDebug(`Parsed ${parsedData.rowCount} rows from ${fileId}`);

    // Add provenance columns
    const rowsWithProvenance = addProvenanceColumns(parsedData.rows, sourceId);
    logDebug(`Added provenance columns to ${rowsWithProvenance.length} rows`);

    // Create DuckDB table
    try {
      await createFileTable(fileId, parsedData.headers);
      logDebug(`Created DuckDB table for file ${fileId}`);
    } catch (error) {
      await handleFileError(
        fileId,
        ErrorType.DATABASE,
        ErrorSeverity.HIGH,
        `Error creating table: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { headers: parsedData.headers, error }
      );
      throw error;
    }

    // Insert data into table
    try {
      await insertFileData(fileId, rowsWithProvenance);
      logDebug(
        `Inserted ${rowsWithProvenance.length} rows into table for file ${fileId}`
      );
    } catch (error) {
      await handleFileError(
        fileId,
        ErrorType.DATABASE,
        ErrorSeverity.HIGH,
        `Error inserting data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { rowCount: rowsWithProvenance.length, error }
      );
      throw error;
    }

    // Convert to Parquet for efficient storage
    let parquetPath: string;
    try {
      parquetPath = await convertToParquet(
        {
          headers: parsedData.headers,
          rows: rowsWithProvenance,
          rowCount: rowsWithProvenance.length,
        },
        fileId
      );
      logDebug(`Converted file to Parquet: ${parquetPath}`);
    } catch (error) {
      // Extract more detailed error information
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorDetails = {
        error,
        headers: parsedData.headers,
        sampleData:
          rowsWithProvenance.length > 0 ? rowsWithProvenance[0] : null,
        missingFields:
          error instanceof Error &&
          error.message.includes("missing required field")
            ? error.message.split("missing required field:")[1]?.trim()
            : null,
      };

      await handleFileError(
        fileId,
        ErrorType.CONVERSION,
        ErrorSeverity.MEDIUM,
        `Error converting to Parquet: ${errorMessage}`,
        errorDetails
      );

      // Log more detailed information for debugging
      console.log(`[ERROR][PARQUET] Detailed error for file ${fileId}:`, {
        message: errorMessage,
        headers: parsedData.headers,
        missingField: errorDetails.missingFields,
      });

      // Add to dead letter queue for later retry
      await addToDeadLetterQueue(
        fileId,
        "parquet_conversion",
        {
          fileId,
          headers: parsedData.headers,
          rowCount: rowsWithProvenance.length,
          errorDetails: errorDetails,
        },
        error
      );

      // Continue without Parquet conversion
      parquetPath = "";
      logDebug("Continuing without Parquet conversion");
    }

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
      rowCount: parsedData.rowCount,
      columns: parsedData.headers,
      parquetPath,
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

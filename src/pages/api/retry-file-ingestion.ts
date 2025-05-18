import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { getPrismaClient } from "../../../lib/prisma/replicaClient";
import { executeQuery } from "../../../lib/database";
import { FileStatus, processFileStreaming } from "../../../lib/fileIngestion";
import {
  handleFileError,
  ErrorType,
  ErrorSeverity,
} from "../../../lib/errorHandling";
import path from "path";
import { UPLOADS_DIR, isVercelEnvironment } from "../../../lib/fileUtils";

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

  try {
    const { fileId } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    logDebug(`Starting retry ingestion process for file ${fileId}`);

    // Get file information from database
    const prisma = getPrismaClient();
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        fileErrors: true,
      },
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Check if file is in error state
    if (file.status !== "error") {
      return res.status(400).json({
        error: "File is not in error state",
        status: file.status,
      });
    }

    // Get the source ID from the sources table
    const source = await prisma.source.findFirst({
      where: { fileId },
    });

    const sourceId = source ? source.id : fileId;

    // Handle file path based on environment
    let filePath = file.filepath || "";

    // If it's a local path in development, ensure it's properly joined
    if (!isVercelEnvironment && !filePath.startsWith("http")) {
      filePath = path.join(UPLOADS_DIR, path.basename(filePath || ""));
    }

    const format = file.format || "csv";

    // Update file status to processing
    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: "processing",
        activationError: null,
      },
    });

    logDebug(`Updated file status to processing`);

    // Clear existing file data to start fresh
    logDebug(`Clearing existing file data for ${fileId}`);
    await prisma.fileData.deleteMany({
      where: { fileId },
    });

    // Clear existing file errors
    logDebug(`Clearing existing file errors for ${fileId}`);
    await prisma.fileError.deleteMany({
      where: { fileId },
    });

    // Process the file with streaming and batch processing
    logDebug(
      `Starting file processing for ${fileId} using streaming approach with reduced batch size`
    );

    // Store for extracted headers
    let extractedHeaders: string[] = [];

    // Track progress
    let lastProgressUpdate = 0;
    const updateProgressInterval = 5000; // Update every 5,000 rows

    const onProgress = (processed: number) => {
      if (processed - lastProgressUpdate >= updateProgressInterval) {
        logDebug(`Processed ${processed} rows from ${fileId}`);
        lastProgressUpdate = processed;
      }
    };

    // Callback for when headers are extracted
    const onHeadersExtracted = async (headers: string[]): Promise<void> => {
      logDebug(`Extracted ${headers.length} columns from file ${fileId}`);
      extractedHeaders = headers;

      // Store headers in file metadata for schema management
      try {
        await prisma.file.update({
          where: { id: fileId },
          data: {
            metadata: {
              columns: headers,
            },
            status: FileStatus.HEADERS_EXTRACTED,
          },
        });

        logDebug(`Stored column headers in file metadata for ${fileId}`);
        logDebug(`Updated file status to indicate headers are available`);
      } catch (metadataError) {
        console.warn(
          `Failed to store column headers in metadata: ${metadataError}`
        );
        // Don't fail the process if metadata update fails
      }
    };

    // Use a very small batch size for retry attempts
    // For very large files, we want to be extra cautious
    let batchSize = 500; // Default retry batch size

    // Adjust batch size based on file size
    if (file.sizeBytes > 150 * 1024 * 1024) {
      // > 150MB - Extremely large files
      batchSize = 100;
    } else if (file.sizeBytes > 100 * 1024 * 1024) {
      // > 100MB - Very large files
      batchSize = 200;
    } else if (file.sizeBytes > 50 * 1024 * 1024) {
      // > 50MB - Large files
      batchSize = 300;
    }

    // Always use a small batch size for retries
    batchSize = Math.max(50, Math.floor(batchSize / 2));

    logDebug(`Using reduced batch size of ${batchSize} for retry`);

    try {
      const processResult = await processFileStreaming(
        filePath,
        fileId,
        sourceId,
        format,
        batchSize,
        onProgress,
        onHeadersExtracted
      );

      logDebug(
        `Successfully processed ${processResult.rowCount} rows from ${fileId}`
      );

      // Update file status to active
      await prisma.file.update({
        where: { id: fileId },
        data: {
          status: FileStatus.ACTIVE,
          ingestedAt: new Date(),
        },
      });

      logDebug(`Updated file status to ${FileStatus.ACTIVE}`);

      return res.status(200).json({
        success: true,
        fileId,
        rowCount: processResult.rowCount,
        columns: processResult.headers,
        message: "File processed successfully after retry.",
      });
    } catch (error) {
      console.error("File ingestion retry error:", error);

      // Handle the error
      await handleFileError(
        fileId,
        ErrorType.SYSTEM,
        ErrorSeverity.HIGH,
        `File ingestion retry failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { error }
      );

      // Update file status to error
      await prisma.file.update({
        where: { id: fileId },
        data: {
          status: FileStatus.ERROR,
          activationError:
            error instanceof Error ? error.message : "Unknown error",
        },
      });

      return res.status(500).json({
        error: "File ingestion retry failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error("File retry error:", error);
    return res.status(500).json({
      error: "Failed to retry file ingestion",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

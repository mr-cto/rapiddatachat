import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { PrismaClient } from "@prisma/client";
import { executeQuery } from "../../../../lib/database";
import {
  handleFileError,
  ErrorType,
  ErrorSeverity,
} from "../../../../lib/errorHandling";

// Initialize Prisma client (singleton)
let prismaInstance: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

// Cache for file synopsis data (fileId -> synopsis data)
const synopsisCache = new Map<
  string,
  {
    data: Record<string, unknown>;
    timestamp: number;
    ttl: number;
  }
>();

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check authentication
  const session = await getServerSession(req, res, authOptions);

  // In development, allow requests without authentication for testing
  const isDevelopment = process.env.NODE_ENV === "development";
  if ((!session || !session.user) && !isDevelopment) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Use a default user email for development
  const userEmail =
    session?.user?.email || (isDevelopment ? "dev@example.com" : "");

  try {
    const { id } = req.query;
    const fileId = Array.isArray(id) ? id[0] : id;

    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    // Clear the cache for testing
    synopsisCache.delete(fileId);

    // Check if synopsis is in cache and not expired
    const cachedSynopsis = synopsisCache.get(fileId);
    if (
      cachedSynopsis &&
      Date.now() - cachedSynopsis.timestamp < cachedSynopsis.ttl
    ) {
      console.log(`Returning cached synopsis for file ${fileId}`);
      return res.status(200).json(cachedSynopsis.data);
    }

    let dbOperationsSkipped = false;
    let file: Record<string, unknown> | null = null;
    let filename = "";
    let format = "";
    let uploadedAt = "";
    let ingestedAt = "";
    let rowCount = 0;
    let columns: Array<{ name: string; type: string }> = [];

    try {
      // Get file information from database to verify ownership
      const fileResult = (await executeQuery(`
        SELECT * FROM files WHERE id = '${fileId}'
      `)) as Array<Record<string, unknown>>;

      // If file doesn't exist
      if (Array.isArray(fileResult) && fileResult.length === 0) {
        return res.status(404).json({ error: "File not found" });
      }

      file = fileResult[0];
      const userId = file.user_id as string;
      filename = file.filename as string;
      format = file.format as string;
      uploadedAt = file.uploaded_at as string;
      ingestedAt = file.ingested_at as string;

      // Verify that the file belongs to the current user
      if (userId !== userEmail && !isDevelopment) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if file data exists
      const prisma = getPrismaClient();
      const fileDataExists = await prisma.fileData.findFirst({
        where: { fileId },
      });

      // If no file data exists, we'll still return basic file info
      // This is common for newly uploaded files that haven't been ingested yet
      if (!fileDataExists) {
        console.log(
          `No file data found for file ${fileId}, returning basic info`
        );
        rowCount = 0;
        columns = [];
      } else {
        // Get row count
        const count = await prisma.fileData.count({
          where: { fileId },
        });
        rowCount = count;

        // Get column information from the first record
        const firstRecord = await prisma.fileData.findFirst({
          where: { fileId },
          select: { data: true },
        });

        if (firstRecord && firstRecord.data) {
          const data = firstRecord.data as Record<string, unknown>;
          columns = Object.keys(data)
            .filter((key) => key !== "source_id" && key !== "ingested_at")
            .map((key) => ({
              name: key,
              type:
                typeof data[key] === "number"
                  ? "NUMBER"
                  : typeof data[key] === "boolean"
                  ? "BOOLEAN"
                  : "TEXT",
            }));
        }
      }
    } catch (dbError) {
      // Check if this is a database connection error
      if (
        dbError instanceof Error &&
        dbError.message.includes("Can't reach database server")
      ) {
        console.warn(
          "Database operation skipped: Unable to retrieve file synopsis data"
        );
        dbOperationsSkipped = true;

        // If we have a filename from the request query, use it
        if (req.query.filename) {
          filename = Array.isArray(req.query.filename)
            ? req.query.filename[0]
            : req.query.filename;
        } else {
          filename = `File ${fileId}`;
        }

        format = (req.query.format as string) || "unknown";

        // Return early with limited data
        return res.status(200).json({
          fileId,
          filename,
          rows: 0,
          columnCount: 0,
          columns: [],
          format,
          uploadedAt: "",
          ingestedAt: "",
          dbOperationsSkipped: true,
          message:
            "File synopsis is limited due to database operations being unavailable",
        });
      } else {
        throw dbError;
      }
    }

    // Create synopsis response
    const synopsis = {
      fileId,
      filename,
      rows: rowCount,
      columnCount: columns.length,
      columns,
      format,
      uploadedAt,
      ingestedAt,
      dbOperationsSkipped,
    };

    // Only cache if we have complete data
    if (!dbOperationsSkipped) {
      synopsisCache.set(fileId, {
        data: synopsis,
        timestamp: Date.now(),
        ttl: CACHE_TTL,
      });
    }

    return res.status(200).json(synopsis);
  } catch (error) {
    console.error("File synopsis error:", error);

    // Get fileId from query
    const { id } = req.query;
    const fileId = Array.isArray(id) ? id[0] : id;

    if (fileId) {
      try {
        await handleFileError(
          fileId,
          ErrorType.SYSTEM,
          ErrorSeverity.MEDIUM,
          `Error generating file synopsis: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          { error }
        );
      } catch (errorHandlingError) {
        console.error("Error handling failed:", errorHandlingError);
      }
    }

    // Check if this is a database connection error
    if (
      error instanceof Error &&
      error.message.includes("Can't reach database server")
    ) {
      // Return a 200 response with limited data instead of an error
      return res.status(200).json({
        fileId,
        filename: req.query.filename || `File ${fileId}`,
        rows: 0,
        columnCount: 0,
        columns: [],
        format: req.query.format || "unknown",
        uploadedAt: "",
        ingestedAt: "",
        dbOperationsSkipped: true,
        message:
          "File synopsis is limited due to database operations being unavailable",
      });
    }

    return res.status(500).json({
      error: "Failed to generate file synopsis",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { executeQuery } from "../../../../lib/database";
import { authOptions } from "../../../../lib/authOptions";

/**
 * API handler for retrieving parsed data for a file
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check authentication
  const session = await getServerSession(req, res, authOptions);

  // Require authentication for all requests
  if (!session || !session.user || !session.user.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id: fileId } = req.query;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 100;
    const offset = req.query.offset
      ? parseInt(req.query.offset as string, 10)
      : 0;

    if (!fileId || typeof fileId !== "string") {
      return res.status(400).json({ error: "File ID is required" });
    }

    // Get file metadata
    const fileResult = (await executeQuery(`
      SELECT id, filename, filepath, metadata, user_id, project_id
      FROM files
      WHERE id = '${fileId}'
    `)) as Array<{
      id: string;
      filename: string;
      filepath: string;
      metadata: string;
      user_id: string;
      project_id: string;
    }>;

    if (!fileResult || fileResult.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = fileResult[0];

    // Check if the user has access to the file
    const userId = session.user.email || session.user.id || "";
    if (file.user_id !== userId) {
      // Check if the user has access to the project
      // Since there's no project_access table in the schema, we'll check if the user owns the project
      const projectOwner = (await executeQuery(`
        SELECT user_id
        FROM projects
        WHERE id = '${file.project_id}' AND user_id = '${userId}'
      `)) as Array<{
        user_id: string;
      }>;

      if (!projectOwner || projectOwner.length === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    // Get parsed data from file_data table
    const parsedDataResult = (await executeQuery(`
      SELECT data as sample_data, NULL as full_data_path
      FROM file_data
      WHERE file_id = '${fileId}'
      LIMIT 1
    `)) as Array<{
      sample_data: string;
      full_data_path: string | null;
    }>;

    if (!parsedDataResult || parsedDataResult.length === 0) {
      return res.status(404).json({ error: "Parsed data not found" });
    }

    // Parse sample data
    let sampleData: any[] = [];
    try {
      if (parsedDataResult[0].sample_data) {
        if (typeof parsedDataResult[0].sample_data === "string") {
          const parsed = JSON.parse(parsedDataResult[0].sample_data);
          // Ensure sampleData is an array
          sampleData = Array.isArray(parsed) ? parsed : [parsed];
        } else if (typeof parsedDataResult[0].sample_data === "object") {
          // Ensure sampleData is an array
          sampleData = Array.isArray(parsedDataResult[0].sample_data)
            ? parsedDataResult[0].sample_data
            : [parsedDataResult[0].sample_data];
        }
      }
    } catch (parseError) {
      console.error(
        `[file-parsed-data] Error parsing sample data for file ${fileId}:`,
        parseError
      );
      return res.status(500).json({
        error: "Error parsing sample data",
        message:
          parseError instanceof Error ? parseError.message : "Unknown error",
      });
    }

    // Apply limit and offset
    const limitedData = sampleData.slice(offset, offset + limit);

    // Parse metadata (which contains column info)
    let columnInfo: any[] = [];
    try {
      if (file.metadata) {
        if (typeof file.metadata === "string") {
          columnInfo = JSON.parse(file.metadata);
        } else if (typeof file.metadata === "object") {
          columnInfo = file.metadata;
        }
      }
    } catch (parseError) {
      console.error(
        `[file-parsed-data] Error parsing metadata for file ${fileId}:`,
        parseError
      );
      // Don't return an error, just log it
      columnInfo = [];
    }

    // Return data
    return res.status(200).json({
      fileId,
      fileName: file.filename,
      filePath: file.filepath,
      columns: columnInfo,
      data: limitedData,
      totalRows: sampleData.length,
      fullDataPath: parsedDataResult[0].full_data_path || null,
    });
  } catch (error) {
    console.error("[file-parsed-data] Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

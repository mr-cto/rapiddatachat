import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { executeQuery } from "../../../../lib/database";

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
      SELECT id, name, file_path, column_info, user_id, project_id
      FROM files
      WHERE id = '${fileId}'
    `)) as Array<{
      id: string;
      name: string;
      file_path: string;
      column_info: string;
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
      const projectAccess = (await executeQuery(`
        SELECT user_id
        FROM project_access
        WHERE project_id = '${file.project_id}' AND user_id = '${userId}'
      `)) as Array<{
        user_id: string;
      }>;

      if (!projectAccess || projectAccess.length === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    // Get parsed data
    const parsedDataResult = (await executeQuery(`
      SELECT sample_data, full_data_path
      FROM file_parsed_data
      WHERE file_id = '${fileId}'
      LIMIT 1
    `)) as Array<{
      sample_data: string;
      full_data_path: string;
    }>;

    if (!parsedDataResult || parsedDataResult.length === 0) {
      return res.status(404).json({ error: "Parsed data not found" });
    }

    // Parse sample data
    let sampleData: any[] = [];
    try {
      if (parsedDataResult[0].sample_data) {
        if (typeof parsedDataResult[0].sample_data === "string") {
          sampleData = JSON.parse(parsedDataResult[0].sample_data);
        } else if (typeof parsedDataResult[0].sample_data === "object") {
          sampleData = parsedDataResult[0].sample_data;
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

    // Parse column info
    let columnInfo: any[] = [];
    try {
      if (file.column_info) {
        if (typeof file.column_info === "string") {
          columnInfo = JSON.parse(file.column_info);
        } else if (typeof file.column_info === "object") {
          columnInfo = file.column_info;
        }
      }
    } catch (parseError) {
      console.error(
        `[file-parsed-data] Error parsing column info for file ${fileId}:`,
        parseError
      );
      // Don't return an error, just log it
      columnInfo = [];
    }

    // Return data
    return res.status(200).json({
      fileId,
      fileName: file.name,
      filePath: file.file_path,
      columns: columnInfo,
      data: limitedData,
      totalRows: sampleData.length,
      fullDataPath: parsedDataResult[0].full_data_path,
    });
  } catch (error) {
    console.error("[file-parsed-data] Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { executeQuery } from "../../../../lib/database";
import {
  getFileParsingResult,
  getColumnInfo,
  getSampleData,
} from "../../../../lib/fileParsingService";

interface FileRecord {
  id: string;
  user_id: string;
  filename: string;
  status: string;
  uploaded_at: string;
  size_bytes: number;
  format: string;
  filepath: string;
}

/**
 * API endpoint for parsing files and extracting column information
 */
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

  try {
    // Get file ID from the request
    const { id } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "File ID is required" });
    }

    // Get query parameters
    const type = (req.query.type as string) || "all";
    const sampleSize = (req.query.sampleSize as string) || "100";
    const parsedSampleSize = parseInt(sampleSize, 10) || 100;

    // Get file information from the database
    const fileResult = (await executeQuery(`
      SELECT * FROM files WHERE id = '${id}'
    `)) as FileRecord[];

    if (!fileResult || !Array.isArray(fileResult) || fileResult.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = fileResult[0];
    const filePath = file.filepath;

    // Parse the file based on the requested type
    switch (type) {
      case "columns":
        // Get column information only
        const columns = await getColumnInfo(filePath, parsedSampleSize);
        return res.status(200).json({ columns });

      case "sample":
        // Get sample data only
        const sampleData = await getSampleData(filePath, parsedSampleSize);
        return res.status(200).json({ sampleData });

      case "all":
      default:
        // Get full parsing result
        const result = await getFileParsingResult(filePath, parsedSampleSize);
        return res.status(200).json(result);
    }
  } catch (error) {
    console.error("Error parsing file:", error);
    return res.status(500).json({
      error: "Failed to parse file",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

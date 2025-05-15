import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { executeQuery } from "../../../lib/database";

/**
 * Interface for file contribution
 */
interface FileContribution {
  fileId: string;
  fileName: string;
  uploadDate: Date;
  columnNames: string[];
}

/**
 * API handler for schema file contributions
 *
 * GET /api/schema-file-contributions?schemaId=<schemaId> - Get files that contribute to a schema
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  const isDevelopment = process.env.NODE_ENV === "development";

  if ((!session || !session.user) && !isDevelopment) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Only allow GET requests
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { schemaId } = req.query;

    // Validate required parameters
    if (!schemaId) {
      return res.status(400).json({ error: "schemaId is required" });
    }

    // Get file contributions
    const contributions = await getFileContributions(schemaId as string);
    return res.status(200).json(contributions);
  } catch (error) {
    console.error("Error handling schema file contributions request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Get files that contribute to a schema
 * @param schemaId Schema ID
 * @returns Promise<FileContribution[]> File contributions
 */
async function getFileContributions(
  schemaId: string
): Promise<FileContribution[]> {
  try {
    // Check if the column_mappings table exists
    const tableExists = await checkIfTableExists("column_mappings");

    if (!tableExists) {
      return [];
    }

    // Get file contributions
    const query = `
      SELECT
        f.id as file_id,
        f.filename as file_name,
        f.uploaded_at as upload_date,
        cm.file_column as file_column,
        sc.name as schema_column_name
      FROM files f
      JOIN column_mappings cm ON f.id = cm.file_id
      JOIN schema_columns sc ON cm.schema_column_id = sc.id
      WHERE cm.global_schema_id = $1
      ORDER BY f.uploaded_at DESC
    `;

    const result = (await executeQuery(query, [schemaId])) as any[];

    if (!result || result.length === 0) {
      return [];
    }

    // Process results
    const contributions: FileContribution[] = [];

    // Group by file
    const fileMap = new Map<
      string,
      {
        fileId: string;
        fileName: string;
        uploadDate: Date;
        columnNames: Set<string>;
      }
    >();

    for (const row of result) {
      const fileId = row.file_id;

      if (!fileMap.has(fileId)) {
        fileMap.set(fileId, {
          fileId,
          fileName: row.file_name,
          uploadDate: new Date(row.upload_date),
          columnNames: new Set<string>(),
        });
      }

      // Add schema column name to the set
      if (row.schema_column_name) {
        fileMap.get(fileId)!.columnNames.add(row.schema_column_name);
      }
    }

    // Convert map to array of contributions
    for (const fileData of fileMap.values()) {
      contributions.push({
        fileId: fileData.fileId,
        fileName: fileData.fileName,
        uploadDate: fileData.uploadDate,
        columnNames: Array.from(fileData.columnNames),
      });
    }

    return contributions;
  } catch (error) {
    console.error("Error getting file contributions:", error);
    throw error;
  }
}

/**
 * Check if a table exists
 * @param tableName Table name
 * @returns Promise<boolean> True if the table exists
 */
async function checkIfTableExists(tableName: string): Promise<boolean> {
  try {
    const result = (await executeQuery(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = '${tableName}'
      ) as exists
    `)) as any[];

    return result && result.length > 0 && result[0].exists;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

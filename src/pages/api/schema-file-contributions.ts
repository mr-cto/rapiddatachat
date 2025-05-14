import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
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
  const session = await getSession({ req });

  if (!session) {
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
        f.original_filename as file_name,
        f.uploaded_at as upload_date,
        cm.file_columns as file_columns,
        cm.schema_columns as schema_columns
      FROM files f
      JOIN column_mappings cm ON f.id = cm.file_id
      WHERE cm.schema_id = $1
      ORDER BY f.uploaded_at DESC
    `;

    const result = await executeQuery(query, [schemaId]);

    if (!result || !result.rows || result.rows.length === 0) {
      return [];
    }

    // Process results
    const contributions: FileContribution[] = [];
    for (const row of result.rows) {
      let fileColumns: any[] = [];
      let schemaColumns: any[] = [];

      // Parse file columns
      try {
        if (typeof row.file_columns === "string") {
          fileColumns = JSON.parse(row.file_columns);
        } else if (Array.isArray(row.file_columns)) {
          fileColumns = row.file_columns;
        }
      } catch (error) {
        console.error("Error parsing file columns:", error);
      }

      // Parse schema columns
      try {
        if (typeof row.schema_columns === "string") {
          schemaColumns = JSON.parse(row.schema_columns);
        } else if (Array.isArray(row.schema_columns)) {
          schemaColumns = row.schema_columns;
        }
      } catch (error) {
        console.error("Error parsing schema columns:", error);
      }

      // Extract column names
      const columnNames = schemaColumns.map((col: any) => col.name);

      // Add contribution
      contributions.push({
        fileId: row.file_id,
        fileName: row.file_name,
        uploadDate: new Date(row.upload_date),
        columnNames,
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
    `)) as Array<{ exists: boolean }>;

    return result && result.length > 0 && result[0].exists;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

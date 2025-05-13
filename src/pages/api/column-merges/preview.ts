import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { executeQuery } from "../../../../lib/database";

/**
 * API endpoint for generating a preview of merged columns
 * @param req NextApiRequest
 * @param res NextApiResponse
 * @returns Promise<void>
 */
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

  // Use a default user email for development
  const userEmail =
    session?.user?.email || (isDevelopment ? "dev@example.com" : "");

  try {
    const { fileId, columnList, delimiter = "", limit = 5 } = req.body;

    // Validate required fields
    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    if (!columnList || !Array.isArray(columnList) || columnList.length === 0) {
      return res
        .status(400)
        .json({ error: "Column list must be a non-empty array" });
    }

    // Special handling for query results (virtual file)
    if (fileId === "query-results") {
      return res.status(400).json({
        error: "Preview generation for query results is not supported",
      });
    }

    // Get the base view name for the file
    const sanitizedUserId = userEmail.replace(/[^a-zA-Z0-9]/g, "_");
    const baseViewName = `data_${sanitizedUserId}_${fileId.replace(/-/g, "_")}`;

    // Check if the base view exists
    const baseViewExists = await checkIfViewExists(baseViewName);
    if (!baseViewExists) {
      // Try alternative base view name
      const alternativeBaseViewName = `data_file_${fileId.replace(/-/g, "_")}`;
      const alternativeBaseViewExists = await checkIfViewExists(
        alternativeBaseViewName
      );

      if (!alternativeBaseViewExists) {
        return res.status(404).json({
          error: `Base view for file ${fileId} does not exist`,
        });
      }
    }

    // Build the SQL query to get the preview data
    const viewName = baseViewExists
      ? baseViewName
      : `data_file_${fileId.replace(/-/g, "_")}`;

    // Create the column selection part of the query
    const columnSelections = columnList.map(
      (col) => `data->>'${col}' AS "${col}"`
    );

    // Create the merged column expression
    const mergedColumnExpr = columnList
      .map((col) => `TRIM(COALESCE(data->>'${col}', ''))`)
      .join(` || '${delimiter}' || `);

    // Build the full query
    const query = `
      SELECT 
        ${columnSelections.join(", ")},
        ${mergedColumnExpr} AS "mergedColumn"
      FROM ${viewName}
      LIMIT ${limit}
    `;

    // Execute the query
    const previewData = await executeQuery(query);

    // Return the preview data
    return res.status(200).json({
      previewData,
    });
  } catch (error) {
    console.error("Error generating preview:", error);
    return res.status(500).json({
      error: "Failed to generate preview",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Check if a view exists in the database
 * @param viewName Name of the view to check
 * @returns Promise<boolean> True if the view exists, false otherwise
 */
async function checkIfViewExists(viewName: string): Promise<boolean> {
  try {
    const result = (await executeQuery(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.views
        WHERE table_name = '${viewName}'
      ) AS view_exists
    `)) as Array<{ view_exists: boolean }>;

    return result && result.length > 0 && result[0].view_exists === true;
  } catch (error) {
    console.error(`Error checking if view ${viewName} exists:`, error);
    return false;
  }
}

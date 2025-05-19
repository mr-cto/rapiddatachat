import { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "../../../../lib/middleware/authMiddleware";

export default withAuth(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get request body
    const { fileId, columnList, delimiter, limit = 5 } = req.body;

    // Validate required parameters
    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }
    if (!columnList || !Array.isArray(columnList) || columnList.length === 0) {
      return res.status(400).json({ error: "Column list is required" });
    }

    // For preview mode, we'll return mock data
    if (fileId === "preview") {
      // Generate mock preview data
      const previewData = [];

      // Create 5 rows of mock data
      for (let i = 0; i < limit; i++) {
        const row: Record<string, unknown> = {};

        // Add original columns
        columnList.forEach((column) => {
          row[column] = `Sample ${column} ${i + 1}`;
        });

        // Add merged column
        row.mergedColumn = columnList
          .map((col) => `Sample ${col} ${i + 1}`)
          .filter(Boolean)
          .join(delimiter || " ");

        previewData.push(row);
      }

      // Return preview data
      return res.status(200).json({ previewData });
    }

    // For real files, we would fetch data from the database
    // But since we're focusing on the preview functionality, we'll just return an error
    return res.status(400).json({
      error: "This endpoint is only for preview mode",
      details: "For actual files, use the regular column-merges endpoint",
    });
  } catch (error) {
    console.error("Error generating column merge preview:", error);
    return res.status(500).json({
      error: "Failed to generate column merge preview",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

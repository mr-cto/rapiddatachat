import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { SchemaVersionService } from "../../../../lib/schemaVersionService";

/**
 * API handler for schema version comparison
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

  // Use user email for compatibility with existing data
  // If email is not available, fall back to the user ID
  const userId = session.user.email || session.user.id || "";
  const schemaVersionService = new SchemaVersionService();

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { schemaId, fromVersion, toVersion, generateScript } = req.body;

    if (!schemaId) {
      return res.status(400).json({ error: "Schema ID is required" });
    }

    if (!fromVersion || !toVersion) {
      return res.status(400).json({
        error: "Both fromVersion and toVersion are required",
      });
    }

    // Get the versions
    const fromVersionObj = await schemaVersionService.getSchemaVersion(
      schemaId,
      parseInt(fromVersion, 10)
    );
    const toVersionObj = await schemaVersionService.getSchemaVersion(
      schemaId,
      parseInt(toVersion, 10)
    );

    if (!fromVersionObj) {
      return res.status(404).json({
        error: `Version ${fromVersion} not found for schema ${schemaId}`,
      });
    }

    if (!toVersionObj) {
      return res.status(404).json({
        error: `Version ${toVersion} not found for schema ${schemaId}`,
      });
    }

    // Compare the versions
    const comparison = schemaVersionService.compareSchemas(
      fromVersionObj.columns,
      toVersionObj.columns
    );

    // Generate change script if requested
    let changeScript = null;
    if (generateScript === true) {
      changeScript = schemaVersionService.generateChangeScript(comparison);
    }

    return res.status(200).json({
      comparison,
      changeScript,
      fromVersion: fromVersionObj,
      toVersion: toVersionObj,
    });
  } catch (error) {
    console.error("Error in schema-versions/compare API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

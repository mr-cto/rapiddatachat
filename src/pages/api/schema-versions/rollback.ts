import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { SchemaVersionService } from "../../../../lib/schemaVersionService";
import { GlobalSchemaService } from "../../../../lib/globalSchemaService";

/**
 * API handler for schema version rollback
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
  const globalSchemaService = new GlobalSchemaService();

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { schemaId, version } = req.body;

    if (!schemaId) {
      return res.status(400).json({ error: "Schema ID is required" });
    }

    if (!version) {
      return res.status(400).json({ error: "Version is required" });
    }

    // Get the schema
    const schema = await globalSchemaService.getGlobalSchemaById(schemaId);

    if (!schema) {
      return res.status(404).json({ error: "Schema not found" });
    }

    // Check if the user owns the schema
    if (schema.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Rollback the schema
    const result = await schemaVersionService.rollbackSchema(
      schemaId,
      parseInt(version, 10),
      userId
    );

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in schema-versions/rollback API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

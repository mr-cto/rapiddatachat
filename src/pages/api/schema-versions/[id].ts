import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { GlobalSchemaService } from "../../../../lib/globalSchemaService";

/**
 * API handler for schema versions
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

  // Get schema ID from the request
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  // Use user email for compatibility with existing data
  // If email is not available, fall back to the user ID
  const userId = session.user.email || session.user.id || "";
  const schemaService = new GlobalSchemaService();

  try {
    // Get the schema
    const schema = await schemaService.getGlobalSchemaById(id);

    if (!schema) {
      return res.status(404).json({ error: "Schema not found" });
    }

    // Check if the schema belongs to the user
    if (schema.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Get all versions of the schema
    const versions = [];
    let currentSchema = schema;
    versions.push(currentSchema);

    // Traverse the version history
    while (currentSchema.previousVersionId) {
      const previousSchema = await schemaService.getGlobalSchemaById(
        currentSchema.previousVersionId
      );

      if (!previousSchema) {
        break;
      }

      versions.push(previousSchema);
      currentSchema = previousSchema;
    }

    return res.status(200).json({ versions });
  } catch (error) {
    console.error("Error in schema-versions API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

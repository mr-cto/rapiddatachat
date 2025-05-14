import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { GlobalSchemaService } from "../../../../lib/globalSchemaService";
import { SchemaVersionService } from "../../../../lib/schemaVersionService";

/**
 * API handler for schema version operations
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
    // Handle different HTTP methods
    switch (req.method) {
      case "GET":
        return await handleGetVersions(req, res, schemaVersionService);

      case "POST":
        return await handleCreateVersion(
          req,
          res,
          userId,
          schemaVersionService,
          globalSchemaService
        );

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error in schema-versions API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle GET requests for schema versions
 */
async function handleGetVersions(
  req: NextApiRequest,
  res: NextApiResponse,
  schemaVersionService: SchemaVersionService
) {
  const { schemaId } = req.query;

  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  const versions = await schemaVersionService.getSchemaVersions(
    schemaId as string
  );

  return res.status(200).json({ versions });
}

/**
 * Handle POST requests for creating a new schema version
 */
async function handleCreateVersion(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  schemaVersionService: SchemaVersionService,
  globalSchemaService: GlobalSchemaService
) {
  const { schemaId, comment } = req.body;

  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
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

  // Create a new version
  const version = await schemaVersionService.createSchemaVersion(
    schema,
    userId,
    comment
  );

  return res.status(201).json({ version });
}

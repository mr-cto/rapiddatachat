import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { SchemaMetadataService } from "../../../lib/schemaMetadataService";
import { GlobalSchemaService } from "../../../lib/globalSchemaService";

/**
 * API handler for schema changes operations
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
  const metadataService = new SchemaMetadataService();
  const schemaService = new GlobalSchemaService();

  try {
    // Initialize the metadata tables if needed
    await metadataService.initialize();

    // Handle different HTTP methods
    switch (req.method) {
      case "GET":
        return await handleGetChanges(
          req,
          res,
          userId,
          metadataService,
          schemaService
        );

      case "POST":
        return await handleRecordChange(
          req,
          res,
          userId,
          metadataService,
          schemaService
        );

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error in schema-changes API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle GET requests for changes
 */
async function handleGetChanges(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  metadataService: SchemaMetadataService,
  schemaService: GlobalSchemaService
) {
  const { schemaId, limit, offset } = req.query;

  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  // Check if the schema exists and belongs to the user
  const schema = await schemaService.getGlobalSchemaById(schemaId as string);
  if (!schema) {
    return res.status(404).json({ error: "Schema not found" });
  }

  if (schema.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Parse limit and offset
  const parsedLimit = limit ? parseInt(limit as string, 10) : 100;
  const parsedOffset = offset ? parseInt(offset as string, 10) : 0;

  // Get changes for the schema
  const changes = await metadataService.getChanges(
    schemaId as string,
    parsedLimit,
    parsedOffset
  );

  return res.status(200).json({
    changes,
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total: changes.length, // This is not the total count, just the count of returned items
      hasMore: changes.length === parsedLimit, // If we got exactly the limit, there might be more
    },
  });
}

/**
 * Handle POST requests for recording changes
 */
async function handleRecordChange(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  metadataService: SchemaMetadataService,
  schemaService: GlobalSchemaService
) {
  const { schemaId, changeType, description, details } = req.body;

  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  if (!changeType) {
    return res.status(400).json({ error: "Change type is required" });
  }

  if (!description) {
    return res.status(400).json({ error: "Change description is required" });
  }

  // Validate change type
  const validChangeTypes = [
    "create",
    "update",
    "delete",
    "column_add",
    "column_update",
    "column_delete",
  ];
  if (!validChangeTypes.includes(changeType)) {
    return res.status(400).json({
      error: "Invalid change type",
      validTypes: validChangeTypes,
    });
  }

  // Check if the schema exists and belongs to the user
  const schema = await schemaService.getGlobalSchemaById(schemaId);
  if (!schema) {
    return res.status(404).json({ error: "Schema not found" });
  }

  if (schema.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Record the change
  const change = await metadataService.recordChange(
    schemaId,
    changeType,
    description,
    details || {},
    userId
  );

  return res.status(200).json({ change });
}

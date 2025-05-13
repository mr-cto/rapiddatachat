import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { SchemaMetadataService } from "../../../lib/schemaMetadataService";
import { GlobalSchemaService } from "../../../lib/globalSchemaService";

/**
 * API handler for schema metadata operations
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
        return await handleGetMetadata(
          req,
          res,
          userId,
          metadataService,
          schemaService
        );

      case "POST":
        return await handleSetMetadata(
          req,
          res,
          userId,
          metadataService,
          schemaService
        );

      case "DELETE":
        return await handleDeleteMetadata(
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
    console.error("Error in schema-metadata API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle GET requests for metadata
 */
async function handleGetMetadata(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  metadataService: SchemaMetadataService,
  schemaService: GlobalSchemaService
) {
  const { schemaId, key } = req.query;

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

  // If key is provided, get specific metadata
  if (key) {
    const metadata = await metadataService.getMetadata(
      schemaId as string,
      key as string
    );

    if (!metadata) {
      return res.status(404).json({ error: "Metadata not found" });
    }

    return res.status(200).json({ metadata });
  } else {
    // Get all metadata for the schema
    const metadata = await metadataService.getAllMetadata(schemaId as string);
    return res.status(200).json({ metadata });
  }
}

/**
 * Handle POST requests for setting metadata
 */
async function handleSetMetadata(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  metadataService: SchemaMetadataService,
  schemaService: GlobalSchemaService
) {
  const { schemaId, key, value } = req.body;

  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  if (!key) {
    return res.status(400).json({ error: "Metadata key is required" });
  }

  if (value === undefined) {
    return res.status(400).json({ error: "Metadata value is required" });
  }

  // Check if the schema exists and belongs to the user
  const schema = await schemaService.getGlobalSchemaById(schemaId);
  if (!schema) {
    return res.status(404).json({ error: "Schema not found" });
  }

  if (schema.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Set the metadata
  const metadata = await metadataService.setMetadata(
    schemaId,
    key,
    value,
    userId
  );

  // Record the change
  await metadataService.recordChange(
    schemaId,
    "update",
    `Updated metadata: ${key}`,
    {
      key,
      value,
    },
    userId
  );

  return res.status(200).json({ metadata });
}

/**
 * Handle DELETE requests for metadata
 */
async function handleDeleteMetadata(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  metadataService: SchemaMetadataService,
  schemaService: GlobalSchemaService
) {
  const { schemaId, key } = req.query;

  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  if (!key) {
    return res.status(400).json({ error: "Metadata key is required" });
  }

  // Check if the schema exists and belongs to the user
  const schema = await schemaService.getGlobalSchemaById(schemaId as string);
  if (!schema) {
    return res.status(404).json({ error: "Schema not found" });
  }

  if (schema.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Get the metadata before deleting it (for the change record)
  const metadata = await metadataService.getMetadata(
    schemaId as string,
    key as string
  );

  // Delete the metadata
  const success = await metadataService.deleteMetadata(
    schemaId as string,
    key as string
  );

  if (!success) {
    return res.status(500).json({ error: "Failed to delete metadata" });
  }

  // Record the change
  if (metadata) {
    await metadataService.recordChange(
      schemaId as string,
      "delete",
      `Deleted metadata: ${key}`,
      {
        key,
        previousValue: metadata.value,
      },
      userId
    );
  }

  return res.status(200).json({ success: true });
}

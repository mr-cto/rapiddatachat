import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { SchemaMetadataService } from "../../../lib/schemaMetadataService";
import { GlobalSchemaService } from "../../../lib/globalSchemaService";

/**
 * API handler for schema documentation operations
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
        return await handleGetDocumentation(
          req,
          res,
          userId,
          metadataService,
          schemaService
        );

      case "POST":
        return await handleSetDocumentation(
          req,
          res,
          userId,
          metadataService,
          schemaService
        );

      case "DELETE":
        return await handleDeleteDocumentation(
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
    console.error("Error in schema-documentation API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle GET requests for documentation
 */
async function handleGetDocumentation(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  metadataService: SchemaMetadataService,
  schemaService: GlobalSchemaService
) {
  const { schemaId, section } = req.query;

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

  // If section is provided, get specific documentation
  if (section) {
    const documentation = await metadataService.getDocumentation(
      schemaId as string,
      section as string
    );

    if (!documentation) {
      return res.status(404).json({ error: "Documentation not found" });
    }

    return res.status(200).json({ documentation });
  } else {
    // Get all documentation for the schema
    const documentation = await metadataService.getAllDocumentation(
      schemaId as string
    );
    return res.status(200).json({ documentation });
  }
}

/**
 * Handle POST requests for setting documentation
 */
async function handleSetDocumentation(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  metadataService: SchemaMetadataService,
  schemaService: GlobalSchemaService
) {
  const { schemaId, section, content } = req.body;

  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  if (!section) {
    return res.status(400).json({ error: "Documentation section is required" });
  }

  if (!content) {
    return res.status(400).json({ error: "Documentation content is required" });
  }

  // Check if the schema exists and belongs to the user
  const schema = await schemaService.getGlobalSchemaById(schemaId);
  if (!schema) {
    return res.status(404).json({ error: "Schema not found" });
  }

  if (schema.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Check if the documentation already exists
  const existingDocumentation = await metadataService.getDocumentation(
    schemaId,
    section
  );

  // Set the documentation
  const documentation = await metadataService.setDocumentation(
    schemaId,
    section,
    content,
    userId
  );

  // Record the change
  await metadataService.recordChange(
    schemaId,
    "update",
    existingDocumentation
      ? `Updated documentation: ${section}`
      : `Added documentation: ${section}`,
    {
      section,
      content:
        content.length > 100 ? content.substring(0, 100) + "..." : content,
    },
    userId
  );

  return res.status(200).json({ documentation });
}

/**
 * Handle DELETE requests for documentation
 */
async function handleDeleteDocumentation(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  metadataService: SchemaMetadataService,
  schemaService: GlobalSchemaService
) {
  const { schemaId, section } = req.query;

  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  if (!section) {
    return res.status(400).json({ error: "Documentation section is required" });
  }

  // Check if the schema exists and belongs to the user
  const schema = await schemaService.getGlobalSchemaById(schemaId as string);
  if (!schema) {
    return res.status(404).json({ error: "Schema not found" });
  }

  if (schema.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Get the documentation before deleting it (for the change record)
  const documentation = await metadataService.getDocumentation(
    schemaId as string,
    section as string
  );

  // Delete the documentation
  const success = await metadataService.deleteDocumentation(
    schemaId as string,
    section as string
  );

  if (!success) {
    return res.status(500).json({ error: "Failed to delete documentation" });
  }

  // Record the change
  if (documentation) {
    await metadataService.recordChange(
      schemaId as string,
      "delete",
      `Deleted documentation: ${section}`,
      {
        section,
      },
      userId
    );
  }

  return res.status(200).json({ success: true });
}

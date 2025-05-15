import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import SchemaService, { GlobalSchema } from "../../../lib/schemaManagement";

/**
 * API handler for schema management
 *
 * GET /api/schema-management?projectId=<projectId> - Get all schemas for a project
 * POST /api/schema-management - Create a new schema
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  const isDevelopment = process.env.NODE_ENV === "development";

  if ((!session || !session.user) && !isDevelopment) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Use a default user email for development
  // Check for test user email header (for testing purposes only)
  const testUserEmail = isDevelopment ? req.headers["x-test-user-email"] : null;
  const userEmail =
    session?.user?.email || (isDevelopment ? "dev@example.com" : "");
  const userId = testUserEmail ? String(testUserEmail) : userEmail || "unknown";

  try {
    const globalSchemaService = SchemaService;

    // Handle GET request
    if (req.method === "GET") {
      const { projectId } = req.query;

      // If projectId is provided, get schemas for that project
      if (projectId) {
        const schemas = await globalSchemaService.getGlobalSchemasForProject(
          projectId as string
        );
        console.log(`Found ${schemas.length} schemas for project ${projectId}`);
        return res.status(200).json({ schemas });
      }
      // If no projectId is provided, return an error
      else {
        console.log("No projectId provided, returning error");
        return res
          .status(400)
          .json({ error: "Project ID is required to fetch schemas" });
      }
    }

    // Handle POST request
    if (req.method === "POST") {
      const schema = req.body as Partial<GlobalSchema>;

      // Validate required fields
      if (!schema.userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      if (!schema.projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      if (!schema.name) {
        return res.status(400).json({ error: "name is required" });
      }

      // Create schema
      const newSchema = await globalSchemaService.createGlobalSchema(
        schema.userId,
        schema.projectId,
        schema.name,
        schema.description || "",
        schema.columns || []
      );

      return res.status(201).json(newSchema);
    }

    // Handle PUT request
    if (req.method === "PUT") {
      const schema = req.body;

      if (!schema.id) {
        return res.status(400).json({ error: "Schema ID is required" });
      }

      try {
        // If only updating isActive status
        if (schema.isActive !== undefined && Object.keys(schema).length === 2) {
          // Set the schema as active
          const success = await globalSchemaService.setActiveSchema(
            schema.projectId || "",
            schema.id
          );
          return res.status(200).json({ success });
        } else {
          // Update the full schema
          const updatedSchema = await globalSchemaService.updateGlobalSchema(
            schema
          );
          return res.status(200).json({ schema: updatedSchema });
        }
      } catch (error) {
        console.error("Error updating schema:", error);
        return res.status(500).json({
          error: "Failed to update schema",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Handle DELETE request
    if (req.method === "DELETE") {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: "Schema ID is required" });
      }

      try {
        const success = await globalSchemaService.deleteGlobalSchema(
          id as string
        );
        return res.status(200).json({ success });
      } catch (error) {
        console.error("Error deleting schema:", error);
        return res.status(500).json({
          error: "Failed to delete schema",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling schema management request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

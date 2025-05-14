import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import {
  GlobalSchemaService,
  GlobalSchema,
} from "../../../lib/globalSchemaService";

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
  const session = await getSession({ req });

  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const globalSchemaService = new GlobalSchemaService();

    // Handle GET request
    if (req.method === "GET") {
      const { projectId } = req.query;

      // Validate required parameters
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      // Get schemas for project
      const schemas = await globalSchemaService.getGlobalSchemasForProject(
        projectId as string
      );
      return res.status(200).json(schemas);
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

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling schema management request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

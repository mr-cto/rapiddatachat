import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import {
  GlobalSchemaService,
  GlobalSchema,
} from "../../../../lib/globalSchemaService";
import { SchemaVersionService } from "../../../../lib/schemaVersionService";

/**
 * API handler for schema management
 *
 * GET /api/schema-management/:id - Get a schema by ID
 * PUT /api/schema-management/:id - Update a schema
 * DELETE /api/schema-management/:id - Delete a schema
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

  try {
    const { id } = req.query;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: "Invalid schema ID" });
    }

    const globalSchemaService = new GlobalSchemaService();
    const schemaVersionService = new SchemaVersionService();

    // Handle GET request
    if (req.method === "GET") {
      const schema = await globalSchemaService.getGlobalSchemaById(id);

      if (!schema) {
        return res.status(404).json({ error: "Schema not found" });
      }

      return res.status(200).json(schema);
    }

    // Handle PUT request
    if (req.method === "PUT") {
      const schema = req.body as GlobalSchema;

      // Validate schema
      if (!schema) {
        return res.status(400).json({ error: "Schema is required" });
      }

      // Ensure schema ID matches
      if (schema.id !== id) {
        return res.status(400).json({ error: "Schema ID mismatch" });
      }

      // Get existing schema
      const existingSchema = await globalSchemaService.getGlobalSchemaById(id);

      if (!existingSchema) {
        return res.status(404).json({ error: "Schema not found" });
      }

      // Create a new schema version
      // Use a default user email for development
      // Check for test user email header (for testing purposes only)
      const testUserEmail = isDevelopment
        ? req.headers["x-test-user-email"]
        : null;
      const userEmail =
        session?.user?.email || (isDevelopment ? "dev@example.com" : "");
      const userId = testUserEmail
        ? String(testUserEmail)
        : userEmail || "unknown";

      await schemaVersionService.createSchemaVersion(
        existingSchema,
        userId,
        "Schema updated via management interface"
      );

      // Update schema
      const updatedSchema = await globalSchemaService.updateGlobalSchema(
        schema
      );

      return res.status(200).json(updatedSchema);
    }

    // Handle DELETE request
    if (req.method === "DELETE") {
      const success = await globalSchemaService.deleteGlobalSchema(id);

      if (!success) {
        return res.status(404).json({ error: "Schema not found" });
      }

      return res.status(200).json({ success: true });
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling schema management request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

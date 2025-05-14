import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { SchemaVersionService } from "../../../lib/schemaVersionService";

/**
 * API handler for schema versions
 *
 * GET /api/schema-versions?schemaId=<schemaId> - Get all versions of a schema
 * GET /api/schema-versions?schemaId=<schemaId>&version=<version> - Get a specific version of a schema
 * POST /api/schema-versions/rollback - Rollback a schema to a specific version
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
    const schemaVersionService = new SchemaVersionService();

    // Handle GET requests
    if (req.method === "GET") {
      const { schemaId, version } = req.query;

      // Validate required parameters
      if (!schemaId) {
        return res.status(400).json({ error: "schemaId is required" });
      }

      // Get a specific version
      if (version) {
        const schemaVersion = await schemaVersionService.getSchemaVersion(
          schemaId as string,
          parseInt(version as string, 10)
        );

        if (!schemaVersion) {
          return res.status(404).json({ error: "Schema version not found" });
        }

        return res.status(200).json(schemaVersion);
      }

      // Get all versions
      const versions = await schemaVersionService.getSchemaVersions(
        schemaId as string
      );
      return res.status(200).json(versions);
    }

    // Handle POST requests
    if (req.method === "POST") {
      // Check if this is a rollback request
      if (req.url?.includes("/rollback")) {
        const { schemaId, version } = req.body;

        // Validate required parameters
        if (!schemaId) {
          return res.status(400).json({ error: "schemaId is required" });
        }

        if (!version) {
          return res.status(400).json({ error: "version is required" });
        }

        // Rollback schema
        const result = await schemaVersionService.rollbackSchema(
          schemaId,
          version,
          session.user?.id || "unknown"
        );

        if (!result.success) {
          return res.status(400).json({ error: result.message });
        }

        return res.status(200).json(result);
      }

      return res.status(400).json({ error: "Invalid POST request" });
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling schema versions request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

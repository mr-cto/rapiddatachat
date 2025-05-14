import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import schemaEvolutionService, {
  FileColumn,
  SchemaEvolutionOptions,
} from "../../../lib/schemaEvolutionService";
import { GlobalSchemaService } from "../../../lib/globalSchemaService";

const globalSchemaService = new GlobalSchemaService();

/**
 * API handler for schema evolution
 *
 * POST /api/schema-evolution/identify - Identify new columns in a file
 * POST /api/schema-evolution/evolve - Evolve schema with new columns
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
    // Handle POST requests
    if (req.method === "POST") {
      const { action } = req.query;

      // Identify new columns
      if (action === "identify") {
        return await handleIdentifyNewColumns(req, res);
      }

      // Evolve schema
      if (action === "evolve") {
        return await handleEvolveSchema(req, res);
      }

      // Invalid action
      return res.status(400).json({ error: "Invalid action" });
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling schema evolution request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Handle identify new columns request
 * @param req Request
 * @param res Response
 */
async function handleIdentifyNewColumns(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { fileColumns, schemaId } = req.body;

    // Validate request
    if (!fileColumns || !Array.isArray(fileColumns)) {
      return res.status(400).json({ error: "File columns are required" });
    }

    if (!schemaId) {
      return res.status(400).json({ error: "Schema ID is required" });
    }

    // Get schema
    const schema = await globalSchemaService.getGlobalSchemaById(schemaId);
    if (!schema) {
      return res.status(404).json({ error: "Schema not found" });
    }

    // Identify new columns
    const mappings = schemaEvolutionService.identifyNewColumns(
      fileColumns,
      schema.columns
    );

    // Return mappings
    return res.status(200).json({
      mappings,
      newColumns: mappings.filter((mapping) => mapping.matchType === "none"),
      exactMatches: mappings.filter((mapping) => mapping.matchType === "exact"),
      fuzzyMatches: mappings.filter((mapping) => mapping.matchType === "fuzzy"),
    });
  } catch (error) {
    console.error("Error identifying new columns:", error);
    return res.status(500).json({ error: "Error identifying new columns" });
  }
}

/**
 * Handle evolve schema request
 * @param req Request
 * @param res Response
 */
async function handleEvolveSchema(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { schemaId, newColumns, options } = req.body;
    const session = await getSession({ req });

    // Validate request
    if (!schemaId) {
      return res.status(400).json({ error: "Schema ID is required" });
    }

    if (!newColumns || !Array.isArray(newColumns)) {
      return res.status(400).json({ error: "New columns are required" });
    }

    if (!session?.user?.id) {
      return res.status(401).json({ error: "User ID not found in session" });
    }

    // Get schema
    const schema = await globalSchemaService.getGlobalSchemaById(schemaId);
    if (!schema) {
      return res.status(404).json({ error: "Schema not found" });
    }

    // Evolve schema
    const result = await schemaEvolutionService.evolveSchema(
      schema,
      newColumns as FileColumn[],
      session.user.id,
      options as SchemaEvolutionOptions
    );

    // Return result
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error evolving schema:", error);
    return res.status(500).json({ error: "Error evolving schema" });
  }
}

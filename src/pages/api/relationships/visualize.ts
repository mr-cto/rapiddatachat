import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import {
  RelationshipService,
  VisualizationOptions,
} from "../../../../lib/relationshipManagement/relationshipService";

/**
 * API handler for relationship visualization
 *
 * GET: Generate visualization
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
    // Create a relationship service
    const relationshipService = new RelationshipService();

    // Handle GET request
    if (req.method === "GET") {
      return handleGetRequest(req, res, relationshipService);
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling visualization request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Handle GET request
 * @param req Request
 * @param res Response
 * @param relationshipService Relationship service
 */
async function handleGetRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  relationshipService: RelationshipService
) {
  const { type, projectId, entity, includeFields, includeConstraints, format } =
    req.query;

  // Validate required parameters
  if (!type || !projectId) {
    return res.status(400).json({ error: "type and projectId are required" });
  }

  // Validate type
  if (type !== "erd" && type !== "dependency-graph" && type !== "matrix") {
    return res
      .status(400)
      .json({ error: "type must be one of: erd, dependency-graph, matrix" });
  }

  // Build visualization options
  const options: VisualizationOptions = {
    includeFields: includeFields === "true",
    includeConstraints: includeConstraints === "true",
    format: format as "svg" | "png" | "json" | undefined,
  };

  // Generate visualization
  let visualization;
  if (type === "erd") {
    visualization = await relationshipService.generateERD(
      projectId as string,
      options
    );
  } else if (type === "dependency-graph") {
    if (!entity) {
      return res
        .status(400)
        .json({
          error: "entity is required for dependency-graph visualization",
        });
    }
    visualization = await relationshipService.generateDependencyGraph(
      entity as string,
      projectId as string,
      options
    );
  } else if (type === "matrix") {
    visualization = await relationshipService.generateRelationshipMatrix(
      projectId as string,
      options
    );
  }

  // Set content type based on format
  if (options.format === "svg") {
    res.setHeader("Content-Type", "image/svg+xml");
  } else if (options.format === "png") {
    res.setHeader("Content-Type", "image/png");
  } else {
    res.setHeader("Content-Type", "application/json");
  }

  return res.status(200).send(visualization);
}

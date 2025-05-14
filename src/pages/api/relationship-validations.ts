import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { RelationshipService } from "../../../lib/relationshipManagement/relationshipService";

/**
 * API handler for relationship validations
 *
 * GET: Get validation results
 * POST: Validate relationships
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

    // Handle POST request
    if (req.method === "POST") {
      return handlePostRequest(req, res, relationshipService);
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling relationship validations request:", error);
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
  const { instanceId } = req.query;

  // Validate required parameters
  if (!instanceId) {
    return res.status(400).json({ error: "instanceId is required" });
  }

  // Validate relationship instance
  const validationResult =
    await relationshipService.validateRelationshipInstance(
      instanceId as string
    );

  return res.status(200).json(validationResult);
}

/**
 * Handle POST request
 * @param req Request
 * @param res Response
 * @param relationshipService Relationship service
 */
async function handlePostRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  relationshipService: RelationshipService
) {
  const { entity, projectId } = req.body;

  // Validate required parameters
  if (!entity || !projectId) {
    return res.status(400).json({ error: "entity and projectId are required" });
  }

  // Validate relationships
  const validationResults = await relationshipService.validateRelationships(
    entity,
    projectId
  );

  return res.status(200).json(validationResults);
}

import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { RelationshipService } from "../../../../lib/relationshipManagement/relationshipService";

/**
 * API handler for relationship impact analysis
 *
 * POST: Analyze the impact of a change
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

    // Handle POST request
    if (req.method === "POST") {
      return handlePostRequest(req, res, relationshipService);
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling impact analysis request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
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
  const { entity, recordId, action, projectId } = req.body;

  // Validate required parameters
  if (!entity || !recordId || !action || !projectId) {
    return res
      .status(400)
      .json({ error: "entity, recordId, action, and projectId are required" });
  }

  // Validate action
  if (action !== "delete" && action !== "update") {
    return res
      .status(400)
      .json({ error: 'action must be either "delete" or "update"' });
  }

  // Analyze impact
  const impactAnalysis = await relationshipService.analyzeImpact({
    entity,
    recordId,
    action,
    projectId,
  });

  return res.status(200).json(impactAnalysis);
}

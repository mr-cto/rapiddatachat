import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { RelationshipService } from "../../../lib/relationshipManagement/relationshipService";

/**
 * API handler for relationship instances
 *
 * GET: Get relationship instances
 * POST: Create a relationship instance
 * PUT: Update a relationship instance
 * DELETE: Delete a relationship instance
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

    // Handle PUT request
    if (req.method === "PUT") {
      return handlePutRequest(req, res, relationshipService);
    }

    // Handle DELETE request
    if (req.method === "DELETE") {
      return handleDeleteRequest(req, res, relationshipService);
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling relationship instances request:", error);
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
  const { id, definitionId, sourceRecordId, targetRecordId } = req.query;

  // Get relationship instance by ID
  if (id) {
    const instance = await relationshipService.getRelationshipInstanceById(
      id as string
    );
    if (!instance) {
      return res.status(404).json({ error: "Relationship instance not found" });
    }
    return res.status(200).json(instance);
  }

  // Get relationship instances
  const instances = await relationshipService.getRelationshipInstances(
    definitionId as string | undefined,
    sourceRecordId as string | undefined,
    targetRecordId as string | undefined
  );

  return res.status(200).json(instances);
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
  const { definitionId, sourceRecordId, targetRecordId } = req.body;

  // Validate required parameters
  if (!definitionId || !sourceRecordId || !targetRecordId) {
    return res
      .status(400)
      .json({
        error: "definitionId, sourceRecordId, and targetRecordId are required",
      });
  }

  // Create relationship instance
  const instance = await relationshipService.createRelationshipInstance({
    definitionId,
    sourceRecordId,
    targetRecordId,
  });

  return res.status(201).json(instance);
}

/**
 * Handle PUT request
 * @param req Request
 * @param res Response
 * @param relationshipService Relationship service
 */
async function handlePutRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  relationshipService: RelationshipService
) {
  const { id } = req.query;
  const { definitionId, sourceRecordId, targetRecordId } = req.body;

  // Validate required parameters
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }

  // Update relationship instance
  const instance = await relationshipService.updateRelationshipInstance(
    id as string,
    {
      definitionId,
      sourceRecordId,
      targetRecordId,
    }
  );

  return res.status(200).json(instance);
}

/**
 * Handle DELETE request
 * @param req Request
 * @param res Response
 * @param relationshipService Relationship service
 */
async function handleDeleteRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  relationshipService: RelationshipService
) {
  const { id } = req.query;

  // Validate required parameters
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }

  // Delete relationship instance
  const instance = await relationshipService.deleteRelationshipInstance(
    id as string
  );

  return res.status(200).json(instance);
}

import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import {
  RelationshipService,
  RelationshipType,
  CascadingAction,
} from "../../../lib/relationshipManagement/relationshipService";

/**
 * API handler for relationships
 *
 * GET: Get relationship definitions
 * POST: Create a relationship definition
 * PUT: Update a relationship definition
 * DELETE: Delete a relationship definition
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
    console.error("Error handling relationships request:", error);
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
  const { id, projectId, sourceEntity, targetEntity } = req.query;

  // Get relationship definition by ID
  if (id) {
    const definition = await relationshipService.getRelationshipDefinitionById(
      id as string
    );
    if (!definition) {
      return res
        .status(404)
        .json({ error: "Relationship definition not found" });
    }
    return res.status(200).json(definition);
  }

  // Get relationship definitions
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required" });
  }

  const definitions = await relationshipService.getRelationshipDefinitions(
    projectId as string,
    sourceEntity as string | undefined,
    targetEntity as string | undefined
  );

  return res.status(200).json(definitions);
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
  const {
    sourceEntity,
    targetEntity,
    type,
    sourceField,
    targetField,
    constraints,
    cascading,
    projectId,
  } = req.body;

  // Validate required parameters
  if (
    !sourceEntity ||
    !targetEntity ||
    !type ||
    !sourceField ||
    !targetField ||
    !projectId
  ) {
    return res
      .status(400)
      .json({
        error:
          "sourceEntity, targetEntity, type, sourceField, targetField, and projectId are required",
      });
  }

  // Validate relationship type
  if (!Object.values(RelationshipType).includes(type)) {
    return res
      .status(400)
      .json({ error: `Invalid relationship type: ${type}` });
  }

  // Validate cascading actions
  if (cascading) {
    if (
      cascading.delete &&
      !Object.values(CascadingAction).includes(cascading.delete)
    ) {
      return res
        .status(400)
        .json({
          error: `Invalid cascading delete action: ${cascading.delete}`,
        });
    }
    if (
      cascading.update &&
      !Object.values(CascadingAction).includes(cascading.update)
    ) {
      return res
        .status(400)
        .json({
          error: `Invalid cascading update action: ${cascading.update}`,
        });
    }
  }

  // Create relationship definition
  const definition = await relationshipService.defineRelationship({
    sourceEntity,
    targetEntity,
    type,
    sourceField,
    targetField,
    constraints,
    cascading,
    projectId,
  });

  return res.status(201).json(definition);
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
  const {
    sourceEntity,
    targetEntity,
    type,
    sourceField,
    targetField,
    constraints,
    cascading,
  } = req.body;

  // Validate required parameters
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }

  // Validate relationship type
  if (type && !Object.values(RelationshipType).includes(type)) {
    return res
      .status(400)
      .json({ error: `Invalid relationship type: ${type}` });
  }

  // Validate cascading actions
  if (cascading) {
    if (
      cascading.delete &&
      !Object.values(CascadingAction).includes(cascading.delete)
    ) {
      return res
        .status(400)
        .json({
          error: `Invalid cascading delete action: ${cascading.delete}`,
        });
    }
    if (
      cascading.update &&
      !Object.values(CascadingAction).includes(cascading.update)
    ) {
      return res
        .status(400)
        .json({
          error: `Invalid cascading update action: ${cascading.update}`,
        });
    }
  }

  // Update relationship definition
  const definition = await relationshipService.updateRelationshipDefinition(
    id as string,
    {
      sourceEntity,
      targetEntity,
      type,
      sourceField,
      targetField,
      constraints,
      cascading,
    }
  );

  return res.status(200).json(definition);
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

  // Delete relationship definition
  const definition = await relationshipService.deleteRelationshipDefinition(
    id as string
  );

  return res.status(200).json(definition);
}

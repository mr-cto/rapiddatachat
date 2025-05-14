import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import {
  ValidationService,
  ValidationOptions,
} from "../../../lib/validation/validationService";

/**
 * API handler for validation
 *
 * POST: Validate data
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
    // Create a validation service
    const validationService = new ValidationService();

    // Handle POST request
    if (req.method === "POST") {
      return handlePostRequest(req, res, validationService);
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling validation request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Handle POST request
 * @param req Request
 * @param res Response
 * @param validationService Validation service
 */
async function handlePostRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  validationService: ValidationService
) {
  const { entity, data, projectId, fileId, options } = req.body;

  // Validate required parameters
  if (!entity || !data || !projectId) {
    return res
      .status(400)
      .json({ error: "entity, data, and projectId are required" });
  }

  // Validate data
  if (!Array.isArray(data)) {
    return res.status(400).json({ error: "data must be an array" });
  }

  // Parse options
  const validationOptions: ValidationOptions = {
    skipInvalidRecords: false,
    validateSchema: true,
    validateRelationships: true,
    validateBusinessRules: true,
    validateDataQuality: true,
    ...options,
  };

  // Validate data
  const validationResult = await validationService.validate(
    entity,
    data,
    projectId,
    fileId,
    validationOptions
  );

  return res.status(200).json(validationResult);
}

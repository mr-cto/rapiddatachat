import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import {
  ValidationService,
  ValidationSeverity,
  ValidationRemediation,
} from "../../../lib/validation/validationService";

/**
 * API handler for validation rules
 *
 * GET: Get validation rules
 * POST: Create a validation rule
 * PUT: Update a validation rule
 * DELETE: Delete a validation rule
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

    // Handle GET request
    if (req.method === "GET") {
      return handleGetRequest(req, res, validationService);
    }

    // Handle POST request
    if (req.method === "POST") {
      return handlePostRequest(req, res, validationService);
    }

    // Handle PUT request
    if (req.method === "PUT") {
      return handlePutRequest(req, res, validationService);
    }

    // Handle DELETE request
    if (req.method === "DELETE") {
      return handleDeleteRequest(req, res, validationService);
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling validation rules request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Handle GET request
 * @param req Request
 * @param res Response
 * @param validationService Validation service
 */
async function handleGetRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  validationService: ValidationService
) {
  const { id, projectId, entity, field } = req.query;

  // Get validation rule by ID
  if (id) {
    const rule = await validationService.getValidationRuleById(id as string);
    if (!rule) {
      return res.status(404).json({ error: "Validation rule not found" });
    }
    return res.status(200).json(rule);
  }

  // Get validation rules
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required" });
  }

  const rules = await validationService.getValidationRules(
    projectId as string,
    entity as string | undefined,
    field as string | undefined
  );

  return res.status(200).json(rules);
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
  const {
    entity,
    field,
    type,
    parameters,
    message,
    severity,
    remediation,
    projectId,
  } = req.body;

  // Validate required parameters
  if (!entity || !type || !message || !severity || !remediation || !projectId) {
    return res
      .status(400)
      .json({
        error:
          "entity, type, message, severity, remediation, and projectId are required",
      });
  }

  // Validate severity
  if (!Object.values(ValidationSeverity).includes(severity)) {
    return res.status(400).json({ error: `Invalid severity: ${severity}` });
  }

  // Validate remediation
  if (!Object.values(ValidationRemediation).includes(remediation)) {
    return res
      .status(400)
      .json({ error: `Invalid remediation: ${remediation}` });
  }

  // Create validation rule
  const rule = await validationService.defineValidationRule({
    entity,
    field,
    type,
    parameters,
    message,
    severity,
    remediation,
    projectId,
  });

  return res.status(201).json(rule);
}

/**
 * Handle PUT request
 * @param req Request
 * @param res Response
 * @param validationService Validation service
 */
async function handlePutRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  validationService: ValidationService
) {
  const { id } = req.query;
  const { entity, field, type, parameters, message, severity, remediation } =
    req.body;

  // Validate required parameters
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }

  // Validate severity
  if (severity && !Object.values(ValidationSeverity).includes(severity)) {
    return res.status(400).json({ error: `Invalid severity: ${severity}` });
  }

  // Validate remediation
  if (
    remediation &&
    !Object.values(ValidationRemediation).includes(remediation)
  ) {
    return res
      .status(400)
      .json({ error: `Invalid remediation: ${remediation}` });
  }

  // Update validation rule
  const rule = await validationService.updateValidationRule(id as string, {
    entity,
    field,
    type,
    parameters,
    message,
    severity,
    remediation,
  });

  return res.status(200).json(rule);
}

/**
 * Handle DELETE request
 * @param req Request
 * @param res Response
 * @param validationService Validation service
 */
async function handleDeleteRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  validationService: ValidationService
) {
  const { id } = req.query;

  // Validate required parameters
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }

  // Delete validation rule
  const rule = await validationService.deleteValidationRule(id as string);

  return res.status(200).json(rule);
}

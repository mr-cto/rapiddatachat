import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { ValidationService } from "../../../../lib/validation/validationService";

/**
 * API handler for validation reports
 *
 * GET: Get validation report
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

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling validation report request:", error);
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
  const { id } = req.query;

  // Validate required parameters
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }

  // Get validation run
  const run = await validationService.getValidationRun(id as string);
  if (!run) {
    return res.status(404).json({ error: "Validation run not found" });
  }

  // Generate validation report
  const report = await validationService.generateValidationReport(id as string);

  return res.status(200).json(report);
}

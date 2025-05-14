import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import {
  ErrorHandlingService,
  SystemHealthStatus,
  SystemHealthInput,
} from "../../../lib/errorHandling/errorHandlingService";

/**
 * API handler for system health
 *
 * GET: Get system health
 * POST: Update system health
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
    // Create an error handling service
    const errorHandlingService = new ErrorHandlingService();

    // Handle GET request
    if (req.method === "GET") {
      return handleGetRequest(req, res, errorHandlingService);
    }

    // Handle POST request
    if (req.method === "POST") {
      return handlePostRequest(req, res, errorHandlingService);
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling system health request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Handle GET request
 * @param req Request
 * @param res Response
 * @param errorHandlingService Error handling service
 */
async function handleGetRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  errorHandlingService: ErrorHandlingService
) {
  const { component } = req.query;

  // Get system health
  const healthRecords = await errorHandlingService.getSystemHealth(
    component as string | undefined
  );

  return res.status(200).json(healthRecords);
}

/**
 * Handle POST request
 * @param req Request
 * @param res Response
 * @param errorHandlingService Error handling service
 */
async function handlePostRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  errorHandlingService: ErrorHandlingService
) {
  const { component, status, lastError, metrics } = req.body;

  // Validate required parameters
  if (!component || !status) {
    return res.status(400).json({ error: "component and status are required" });
  }

  // Validate status
  if (!Object.values(SystemHealthStatus).includes(status)) {
    return res.status(400).json({ error: `Invalid status: ${status}` });
  }

  // Update system health
  const healthId = await errorHandlingService.updateSystemHealth({
    component,
    status,
    lastError,
    metrics,
  });

  return res.status(200).json({ id: healthId });
}

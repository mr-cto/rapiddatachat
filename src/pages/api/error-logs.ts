import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import {
  ErrorHandlingService,
  ErrorType,
  ErrorSeverity,
} from "../../../lib/errorHandling/errorHandlingService";

/**
 * API handler for error logs
 *
 * GET: Get error logs
 * POST: Create an error log
 * DELETE: Delete an error log
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

    // Handle DELETE request
    if (req.method === "DELETE") {
      return handleDeleteRequest(req, res, errorHandlingService);
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling error logs request:", error);
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
  const { projectId, errorType, startDate, endDate, limit, offset } = req.query;

  // Get error logs
  const errorLogs = await errorHandlingService.getErrorLogs(
    projectId as string | undefined,
    errorType as ErrorType | undefined,
    startDate ? new Date(startDate as string) : undefined,
    endDate ? new Date(endDate as string) : undefined,
    limit ? parseInt(limit as string) : undefined,
    offset ? parseInt(offset as string) : undefined
  );

  return res.status(200).json(errorLogs);
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
  const {
    type,
    message,
    context,
    stack,
    requestId,
    userId,
    systemState,
    projectId,
    severity,
  } = req.body;

  // Validate required parameters
  if (!type || !message) {
    return res.status(400).json({ error: "type and message are required" });
  }

  // Validate type
  if (!Object.values(ErrorType).includes(type)) {
    return res.status(400).json({ error: `Invalid error type: ${type}` });
  }

  // Validate severity
  if (severity && !Object.values(ErrorSeverity).includes(severity)) {
    return res.status(400).json({ error: `Invalid severity: ${severity}` });
  }

  // Log error
  const errorLogId = await errorHandlingService.logError({
    type,
    message,
    context,
    stack,
    requestId,
    userId,
    systemState,
    projectId,
    severity,
  });

  return res.status(201).json({ id: errorLogId });
}

/**
 * Handle DELETE request
 * @param req Request
 * @param res Response
 * @param errorHandlingService Error handling service
 */
async function handleDeleteRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  errorHandlingService: ErrorHandlingService
) {
  const { id } = req.query;

  // Validate required parameters
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }

  // Delete error log
  // Note: This functionality is not implemented in the ErrorHandlingService
  // It would need to be added if this endpoint is needed
  return res.status(501).json({ error: "Not implemented" });
}

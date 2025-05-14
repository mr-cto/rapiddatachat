import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import {
  ErrorHandlingService,
  ErrorType,
} from "../../../lib/errorHandling/errorHandlingService";

/**
 * API handler for dead letter queue
 *
 * GET: Get dead letter queue items
 * POST: Add to dead letter queue
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
    console.error("Error handling dead letter queue request:", error);
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
  const { projectId, operationType, errorType, limit, offset } = req.query;

  // Get dead letter queue items
  const deadLetterQueueItems =
    await errorHandlingService.getDeadLetterQueueItems(
      projectId as string | undefined,
      operationType as string | undefined,
      errorType as ErrorType | undefined,
      limit ? parseInt(limit as string) : undefined,
      offset ? parseInt(offset as string) : undefined
    );

  return res.status(200).json(deadLetterQueueItems);
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
    operationType,
    operationData,
    errorType,
    errorMessage,
    maxRetries,
    projectId,
    fileId,
  } = req.body;

  // Validate required parameters
  if (
    !operationType ||
    !operationData ||
    !errorType ||
    !errorMessage ||
    !maxRetries
  ) {
    return res
      .status(400)
      .json({
        error:
          "operationType, operationData, errorType, errorMessage, and maxRetries are required",
      });
  }

  // Validate error type
  if (!Object.values(ErrorType).includes(errorType)) {
    return res.status(400).json({ error: `Invalid error type: ${errorType}` });
  }

  // Add to dead letter queue
  const deadLetterQueueItemId = await errorHandlingService.addToDeadLetterQueue(
    {
      operationType,
      operationData,
      errorType,
      errorMessage,
      maxRetries,
      projectId,
      fileId,
    }
  );

  return res.status(201).json({ id: deadLetterQueueItemId });
}

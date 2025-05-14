import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { ErrorHandlingService } from "../../../../../lib/errorHandling/errorHandlingService";

/**
 * API handler for retrying a dead letter queue item
 *
 * POST: Retry a dead letter queue item
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

    // Handle POST request
    if (req.method === "POST") {
      return handlePostRequest(req, res, errorHandlingService);
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling retry request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
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
  const { id } = req.query;

  // Validate required parameters
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }

  // Retry dead letter queue item
  const success = await errorHandlingService.retryDeadLetterQueueItem(
    id as string
  );

  if (success) {
    return res.status(200).json({ success: true });
  } else {
    return res
      .status(500)
      .json({ error: "Failed to retry dead letter queue item" });
  }
}

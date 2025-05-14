import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { BatchProcessingService } from "../../../../../lib/batchProcessing/batchProcessingService";

/**
 * API handler for batch job actions
 *
 * POST: Perform an action on a batch job (start, stop, pause, resume, retry)
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
    // Get batch job ID
    const { id } = req.query;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: "Invalid batch job ID" });
    }

    // Only allow POST requests
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Get action from request body
    const { action } = req.body;

    if (!action) {
      return res.status(400).json({ error: "action is required" });
    }

    // Create a batch processing service
    const batchProcessingService = new BatchProcessingService();

    // Perform action
    switch (action) {
      case "start":
        return handleStartAction(id, res, batchProcessingService);
      case "stop":
        return handleStopAction(id, res, batchProcessingService);
      case "pause":
        return handlePauseAction(id, res, batchProcessingService);
      case "resume":
        return handleResumeAction(id, res, batchProcessingService);
      case "retry":
        return handleRetryAction(id, res, batchProcessingService);
      default:
        return res.status(400).json({ error: `Invalid action: ${action}` });
    }
  } catch (error) {
    console.error("Error handling batch job action:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Handle start action
 * @param id Batch job ID
 * @param res Response
 * @param batchProcessingService Batch processing service
 */
async function handleStartAction(
  id: string,
  res: NextApiResponse,
  batchProcessingService: BatchProcessingService
) {
  try {
    // Start batch job
    const batchJob = await batchProcessingService.startJob(id);
    return res.status(200).json(batchJob);
  } catch (error) {
    console.error(`Error starting batch job ${id}:`, error);
    return res
      .status(400)
      .json({
        error: `Error starting batch job: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
  }
}

/**
 * Handle stop action
 * @param id Batch job ID
 * @param res Response
 * @param batchProcessingService Batch processing service
 */
async function handleStopAction(
  id: string,
  res: NextApiResponse,
  batchProcessingService: BatchProcessingService
) {
  try {
    // Stop batch job
    const batchJob = await batchProcessingService.stopJob(id);
    return res.status(200).json(batchJob);
  } catch (error) {
    console.error(`Error stopping batch job ${id}:`, error);
    return res
      .status(400)
      .json({
        error: `Error stopping batch job: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
  }
}

/**
 * Handle pause action
 * @param id Batch job ID
 * @param res Response
 * @param batchProcessingService Batch processing service
 */
async function handlePauseAction(
  id: string,
  res: NextApiResponse,
  batchProcessingService: BatchProcessingService
) {
  try {
    // Pause batch job (assuming the method exists)
    if (typeof batchProcessingService.pauseJob === "function") {
      const batchJob = await batchProcessingService.pauseJob(id);
      return res.status(200).json(batchJob);
    } else {
      return res.status(501).json({ error: "Pause action not implemented" });
    }
  } catch (error) {
    console.error(`Error pausing batch job ${id}:`, error);
    return res
      .status(400)
      .json({
        error: `Error pausing batch job: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
  }
}

/**
 * Handle resume action
 * @param id Batch job ID
 * @param res Response
 * @param batchProcessingService Batch processing service
 */
async function handleResumeAction(
  id: string,
  res: NextApiResponse,
  batchProcessingService: BatchProcessingService
) {
  try {
    // Resume batch job (assuming the method exists)
    if (typeof batchProcessingService.resumeJob === "function") {
      const batchJob = await batchProcessingService.resumeJob(id);
      return res.status(200).json(batchJob);
    } else {
      return res.status(501).json({ error: "Resume action not implemented" });
    }
  } catch (error) {
    console.error(`Error resuming batch job ${id}:`, error);
    return res
      .status(400)
      .json({
        error: `Error resuming batch job: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
  }
}

/**
 * Handle retry action
 * @param id Batch job ID
 * @param res Response
 * @param batchProcessingService Batch processing service
 */
async function handleRetryAction(
  id: string,
  res: NextApiResponse,
  batchProcessingService: BatchProcessingService
) {
  try {
    // Retry batch job (assuming the method exists)
    if (typeof batchProcessingService.retryJob === "function") {
      const batchJob = await batchProcessingService.retryJob(id);
      return res.status(200).json(batchJob);
    } else {
      return res.status(501).json({ error: "Retry action not implemented" });
    }
  } catch (error) {
    console.error(`Error retrying batch job ${id}:`, error);
    return res
      .status(400)
      .json({
        error: `Error retrying batch job: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
  }
}

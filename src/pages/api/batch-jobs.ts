import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import {
  BatchProcessingService,
  BatchJobStatus,
} from "../../../lib/batchProcessing/batchProcessingService";

/**
 * API handler for batch jobs
 *
 * GET: Get batch jobs
 * POST: Create a batch job
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
    // Create a batch processing service
    const batchProcessingService = new BatchProcessingService();

    // Handle GET request
    if (req.method === "GET") {
      return handleGetRequest(req, res, batchProcessingService);
    }

    // Handle POST request
    if (req.method === "POST") {
      return handlePostRequest(req, res, batchProcessingService);
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling batch jobs request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Handle GET request
 * @param req Request
 * @param res Response
 * @param batchProcessingService Batch processing service
 */
async function handleGetRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  batchProcessingService: BatchProcessingService
) {
  const { projectId, status, limit, offset } = req.query;

  // Get batch jobs
  const batchJobs = await batchProcessingService.getJobs(
    projectId as string | undefined,
    status as BatchJobStatus | undefined,
    limit ? parseInt(limit as string) : undefined,
    offset ? parseInt(offset as string) : undefined
  );

  return res.status(200).json(batchJobs);
}

/**
 * Handle POST request
 * @param req Request
 * @param res Response
 * @param batchProcessingService Batch processing service
 */
async function handlePostRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  batchProcessingService: BatchProcessingService
) {
  const { name, description, configuration, projectId, fileId } = req.body;

  // Validate required parameters
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  // Create batch job
  const batchJob = await batchProcessingService.createJob({
    name,
    description,
    configuration,
    projectId,
    fileId,
  });

  return res.status(201).json(batchJob);
}

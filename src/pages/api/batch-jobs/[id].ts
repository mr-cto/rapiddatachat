import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { BatchProcessingService } from "../../../../lib/batchProcessing/batchProcessingService";

/**
 * API handler for batch job operations
 *
 * GET: Get a batch job
 * DELETE: Delete a batch job
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

    // Create a batch processing service
    const batchProcessingService = new BatchProcessingService();

    // Handle GET request
    if (req.method === "GET") {
      return handleGetRequest(id, res, batchProcessingService);
    }

    // Handle DELETE request
    if (req.method === "DELETE") {
      return handleDeleteRequest(id, res, batchProcessingService);
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling batch job request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Handle GET request
 * @param id Batch job ID
 * @param res Response
 * @param batchProcessingService Batch processing service
 */
async function handleGetRequest(
  id: string,
  res: NextApiResponse,
  batchProcessingService: BatchProcessingService
) {
  try {
    // Get batch job
    const batchJob = await batchProcessingService.getJob(id);
    return res.status(200).json(batchJob);
  } catch (error) {
    console.error(`Error getting batch job ${id}:`, error);
    return res.status(404).json({ error: `Batch job ${id} not found` });
  }
}

/**
 * Handle DELETE request
 * @param id Batch job ID
 * @param res Response
 * @param batchProcessingService Batch processing service
 */
async function handleDeleteRequest(
  id: string,
  res: NextApiResponse,
  batchProcessingService: BatchProcessingService
) {
  try {
    // Delete batch job
    const batchJob = await batchProcessingService.deleteJob(id);
    return res.status(200).json(batchJob);
  } catch (error) {
    console.error(`Error deleting batch job ${id}:`, error);
    return res.status(404).json({ error: `Batch job ${id} not found` });
  }
}

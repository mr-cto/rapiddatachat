import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { getPrismaClient } from "../../../../lib/prisma/replicaClient";

/**
 * API route to get the current status of an import job
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get the user session
    const session = await getServerSession(req, res, authOptions);

    // Check if the user is authenticated
    if (!session || !session.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = session.user.id;

    // Get the job ID from the query parameters
    const { jobId } = req.query;

    if (!jobId || typeof jobId !== "string") {
      return res.status(400).json({ error: "Missing or invalid job ID" });
    }

    // Get the Prisma client
    const prisma = getPrismaClient();

    // Get the import job
    const importJob = await prisma.$queryRaw<any[]>`
      SELECT * FROM import_jobs 
      WHERE id = ${jobId} 
      AND user_id = ${userId}
      LIMIT 1
    `;

    if (!importJob || importJob.length === 0) {
      return res.status(404).json({ error: "Import job not found" });
    }

    const job = importJob[0];

    // Calculate progress percentage
    let progress = 0;
    if (job.total_rows && job.total_rows > 0) {
      progress = Math.min(
        100,
        Math.round((job.rows_processed / job.total_rows) * 100)
      );
    } else if (job.status === "READY") {
      progress = 100;
    } else if (job.status === "PROCESSING") {
      // If we don't know the total rows yet, estimate progress based on time
      if (job.started_at) {
        const startTime = new Date(job.started_at).getTime();
        const currentTime = Date.now();
        const elapsedTime = currentTime - startTime;

        // Assume a 2-minute (120,000 ms) processing time for 100%
        const estimatedProgress = Math.min(
          100,
          Math.round((elapsedTime / 120000) * 100)
        );
        progress = estimatedProgress;
      } else {
        progress = 10; // Default progress for processing without started_at
      }
    }

    // Return the job status
    return res.status(200).json({
      id: job.id,
      status: job.status.toLowerCase(),
      rowsProcessed: job.rows_processed,
      totalRows: job.total_rows,
      progress,
      error: job.error_message,
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      blobDeletedAt: job.blob_deleted_at,
    });
  } catch (error) {
    console.error("Error getting import status:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

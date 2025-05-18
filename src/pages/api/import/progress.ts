import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { getPrismaClient } from "../../../../lib/prisma/replicaClient";

/**
 * API route to stream import job progress updates using Server-Sent Events (SSE)
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

    // Verify the job exists and belongs to the user
    const importJob = await prisma.$queryRaw<any[]>`
      SELECT * FROM import_jobs 
      WHERE id = ${jobId} 
      AND user_id = ${userId}
      LIMIT 1
    `;

    if (!importJob || importJob.length === 0) {
      return res.status(404).json({ error: "Import job not found" });
    }

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering

    // Send initial status
    const job = importJob[0];

    // Calculate initial progress
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

    // Send initial status
    res.write(
      `data: ${JSON.stringify({
        id: job.id,
        status: job.status.toLowerCase(),
        processed: job.rows_processed,
        total: job.total_rows,
        progress,
        error: job.error_message,
      })}\n\n`
    );

    // If the job is already complete or has an error, send a final update and close the connection
    if (job.status === "READY" || job.status === "ERROR") {
      res.write(
        `data: ${JSON.stringify({
          id: job.id,
          status: job.status === "READY" ? "completed" : "error",
          processed: job.rows_processed,
          total: job.total_rows,
          progress: job.status === "READY" ? 100 : progress,
          error: job.error_message,
        })}\n\n`
      );

      res.end();
      return;
    }

    // Set up polling for updates
    const pollInterval = 2000; // Poll every 2 seconds
    const maxDuration = 5 * 60 * 1000; // 5 minutes maximum
    const startTime = Date.now();

    const interval = setInterval(async () => {
      try {
        // Check if we've exceeded the maximum duration
        if (Date.now() - startTime > maxDuration) {
          clearInterval(interval);

          // Send a final message
          res.write(
            `data: ${JSON.stringify({
              id: jobId,
              status: "timeout",
              error: "Maximum streaming duration exceeded",
            })}\n\n`
          );

          res.end();
          return;
        }

        // Get the latest job status
        const latestJob = await prisma.$queryRaw<any[]>`
          SELECT * FROM import_jobs 
          WHERE id = ${jobId} 
          LIMIT 1
        `;

        if (!latestJob || latestJob.length === 0) {
          clearInterval(interval);

          // Send an error message
          res.write(
            `data: ${JSON.stringify({
              id: jobId,
              status: "error",
              error: "Import job not found",
            })}\n\n`
          );

          res.end();
          return;
        }

        const latest = latestJob[0];

        // Calculate progress
        let latestProgress = 0;
        if (latest.total_rows && latest.total_rows > 0) {
          latestProgress = Math.min(
            100,
            Math.round((latest.rows_processed / latest.total_rows) * 100)
          );
        } else if (latest.status === "READY") {
          latestProgress = 100;
        } else if (latest.status === "PROCESSING") {
          // If we don't know the total rows yet, estimate progress based on time
          if (latest.started_at) {
            const jobStartTime = new Date(latest.started_at).getTime();
            const currentTime = Date.now();
            const elapsedTime = currentTime - jobStartTime;

            // Assume a 2-minute (120,000 ms) processing time for 100%
            const estimatedProgress = Math.min(
              100,
              Math.round((elapsedTime / 120000) * 100)
            );
            latestProgress = estimatedProgress;
          } else {
            latestProgress = 10; // Default progress for processing without started_at
          }
        }

        // Send an update
        res.write(
          `data: ${JSON.stringify({
            id: latest.id,
            status: latest.status.toLowerCase(),
            processed: latest.rows_processed,
            total: latest.total_rows,
            progress: latestProgress,
            error: latest.error_message,
          })}\n\n`
        );

        // If the job is complete or has an error, send a final update and close the connection
        if (latest.status === "READY" || latest.status === "ERROR") {
          clearInterval(interval);

          // Send a final message
          res.write(
            `data: ${JSON.stringify({
              id: latest.id,
              status: latest.status === "READY" ? "completed" : "error",
              processed: latest.rows_processed,
              total: latest.total_rows,
              progress: latest.status === "READY" ? 100 : latestProgress,
              error: latest.error_message,
            })}\n\n`
          );

          res.end();
        }
      } catch (error) {
        console.error("Error polling import job status:", error);

        // Don't close the connection on error, just log it and continue
      }
    }, pollInterval);

    // Handle client disconnect
    res.on("close", () => {
      clearInterval(interval);
    });
  } catch (error) {
    console.error("Error setting up SSE for import progress:", error);

    // If headers haven't been sent yet, return a JSON error
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } else {
      // If headers have been sent, send an error event and close the connection
      res.write(
        `data: ${JSON.stringify({
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        })}\n\n`
      );

      res.end();
    }
  }
}

// Configure the API route for SSE
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true,
  },
};

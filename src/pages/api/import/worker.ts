import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { initializeImportWorker } from "../../../../lib/queue/importQueue";
import { processImportJob } from "../../../../lib/import/importWorker";

/**
 * This API route initializes the import worker and processes jobs from the queue
 * It is designed to run as a long-running serverless function (maxDuration = 300s)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get the user session
    const session = await getServerSession(req, res, authOptions);

    // Check if the user is authenticated
    if (!session || !session.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if a specific job ID was provided
    const { jobId } = req.body;

    if (jobId) {
      // Process a specific job directly
      console.log(`Processing specific import job: ${jobId}`);

      // Set up SSE for progress updates
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Process the job with progress updates
      const result = await processImportJob(
        jobId,
        (processed: number, total?: number) => {
          // Send progress updates via SSE
          res.write(
            `data: ${JSON.stringify({
              jobId,
              processed,
              total,
              progress: total ? Math.round((processed / total) * 100) : null,
            })}\n\n`
          );
        }
      );

      // Send the final result
      res.write(
        `data: ${JSON.stringify({
          jobId,
          status: "completed",
          rowCount: result.rowCount,
        })}\n\n`
      );

      // End the response
      res.end();
      return;
    } else {
      // Initialize the worker to process jobs from the queue
      console.log("Initializing import worker");
      const worker = await initializeImportWorker();

      // Keep the worker running for the maximum duration
      const startTime = Date.now();
      const maxDuration = 290 * 1000; // 290 seconds (just under the 300s limit)

      // Set up SSE for worker status updates
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Send initial status
      res.write(`data: ${JSON.stringify({ status: "started" })}\n\n`);

      // Keep the connection alive until we reach the maximum duration
      const interval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = maxDuration - elapsedTime;

        if (remainingTime <= 0) {
          clearInterval(interval);

          // Close the worker
          worker.close();

          // Send final status
          res.write(
            `data: ${JSON.stringify({
              status: "shutdown",
              reason: "max duration reached",
              uptime: elapsedTime / 1000,
            })}\n\n`
          );

          // End the response
          res.end();
        } else {
          // Send heartbeat
          res.write(
            `data: ${JSON.stringify({
              status: "running",
              uptime: elapsedTime / 1000,
              remaining: remainingTime / 1000,
            })}\n\n`
          );
        }
      }, 10000); // Send status update every 10 seconds

      // Handle connection close
      res.on("close", () => {
        clearInterval(interval);
        worker.close();
        console.log("Worker connection closed");
      });
    }
  } catch (error) {
    console.error("Error in import worker:", error);

    // If we haven't sent headers yet, send a JSON error response
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } else {
      // If we've already sent headers (SSE mode), send an error event
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

// Configure the API route to use the maximum duration
export const config = {
  api: {
    bodyParser: true,
    responseLimit: false,
    externalResolver: true,
    // Set the maximum duration to 300 seconds (5 minutes)
    maxDuration: 300,
  },
};

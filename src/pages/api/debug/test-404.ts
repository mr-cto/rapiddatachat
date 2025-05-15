import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import logger from "../../../../lib/logger";
import { withLogging } from "../../../../src/middleware/logging";
import fs from "fs";
import path from "path";

/**
 * API endpoint to test 404 errors and return logs
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Get project ID from query
  const { projectId } = req.query;
  if (!projectId || typeof projectId !== "string") {
    return res.status(400).json({ error: "Project ID is required" });
  }

  try {
    // Generate a unique request ID for tracking
    const requestId = logger.generateRequestId();

    // Set request context
    logger.setRequestContext(requestId, {
      userId: session.user.id,
      method: "GET",
      url: `/project/${projectId}`,
      userAgent: req.headers["user-agent"],
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    });

    // Log the request
    logger.info(`Debug 404 Test: GET /project/${projectId}`, requestId);

    // Simulate a 404 error
    logger.error(`404 Not Found: /project/${projectId}`, requestId, {
      statusCode: 404,
      path: `/project/${projectId}`,
      availablePath: `/project/${projectId}/dashboard`,
      reason: "No route handler for this path",
    });

    // Try to read recent logs from file
    const logs: string[] = [];
    try {
      const logsDir = path.join(process.cwd(), "logs");
      if (fs.existsSync(logsDir)) {
        // Get the most recent log file
        const logFiles = fs
          .readdirSync(logsDir)
          .filter((file) => file.startsWith("application-"))
          .sort()
          .reverse();

        if (logFiles.length > 0) {
          const logFilePath = path.join(logsDir, logFiles[0]);
          const logContent = fs.readFileSync(logFilePath, "utf-8");

          // Extract the last 20 lines
          const logLines = logContent.split("\n").filter(Boolean);
          logs.push(...logLines.slice(-20));
        }
      }
    } catch (error) {
      console.error("Error reading log files:", error);
    }

    // Return the logs
    return res.status(200).json({
      message: "Debug 404 test completed",
      projectId,
      logs,
    });
  } catch (error) {
    console.error("Error in debug 404 test:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export default withLogging(handler);

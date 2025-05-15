import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import fs from "fs";
import path from "path";
import logConfig from "../../../lib/logConfig";
import logger from "../../../lib/logger";
import withLogging from "../../middleware/logging";

/**
 * API endpoint for debug operations
 * @param req NextApiRequest
 * @param res NextApiResponse
 * @returns Promise<void>
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check authentication
  const session = await getServerSession(req, res, authOptions);

  // Only allow in development mode or for authenticated users
  const isDevelopment = process.env.NODE_ENV === "development";
  if (!isDevelopment && (!session || !session.user)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Handle different HTTP methods
  switch (req.method) {
    case "GET":
      return handleGetRequest(req, res);
    case "POST":
      return handlePostRequest(req, res);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

/**
 * Handle GET requests for debug information
 * @param req NextApiRequest
 * @param res NextApiResponse
 * @returns Promise<void>
 */
async function handleGetRequest(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { action } = req.query;

    switch (action) {
      case "config":
        // Return the current logging configuration
        return res.status(200).json({
          config: logConfig.getLogConfig(),
          debugMode: logConfig.isDebugMode(),
        });

      case "logs":
        // Return the latest logs
        return res
          .status(200)
          .json(await getLatestLogs(req.query.type as string));

      default:
        // Return debug status
        return res.status(200).json({
          debugMode: logConfig.isDebugMode(),
          environment: process.env.NODE_ENV || "development",
          timestamp: new Date().toISOString(),
        });
    }
  } catch (error) {
    console.error("Error handling debug GET request:", error);
    return res.status(500).json({
      error: "Failed to process debug request",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle POST requests for debug operations
 * @param req NextApiRequest
 * @param res NextApiResponse
 * @returns Promise<void>
 */
async function handlePostRequest(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { action, config } = req.body;

    switch (action) {
      case "enable":
        // Enable debug mode
        logConfig.enableDebugMode();
        logger.info("Debug mode enabled");
        return res.status(200).json({
          message: "Debug mode enabled",
          debugMode: true,
        });

      case "disable":
        // Disable debug mode
        logConfig.disableDebugMode();
        logger.info("Debug mode disabled");
        return res.status(200).json({
          message: "Debug mode disabled",
          debugMode: false,
        });

      case "update":
        // Update logging configuration
        if (!config) {
          return res.status(400).json({ error: "Config is required" });
        }
        const updatedConfig = logConfig.updateLogConfig(config);
        logger.info("Logging configuration updated", undefined, {
          config: updatedConfig,
        });
        return res.status(200).json({
          message: "Logging configuration updated",
          config: updatedConfig,
        });

      case "reset":
        // Reset logging configuration
        const resetConfig = logConfig.resetLogConfig();
        logger.info("Logging configuration reset to defaults");
        return res.status(200).json({
          message: "Logging configuration reset to defaults",
          config: resetConfig,
        });

      case "test":
        // Generate test logs
        generateTestLogs();
        return res.status(200).json({
          message: "Test logs generated",
        });

      default:
        return res.status(400).json({ error: "Invalid action" });
    }
  } catch (error) {
    console.error("Error handling debug POST request:", error);
    return res.status(500).json({
      error: "Failed to process debug request",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Get the latest logs from the log files
 * @param type Log type (application, error, or all)
 * @returns Latest logs
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLatestLogs(type: string = "all"): Promise<any> {
  try {
    const config = logConfig.getLogConfig();
    const logsDir = path.join(process.cwd(), config.logDir);

    // Check if logs directory exists
    if (!fs.existsSync(logsDir)) {
      return { logs: [], error: "Logs directory does not exist" };
    }

    // Get all log files
    const files = fs.readdirSync(logsDir);

    // Filter log files based on type
    const logFiles = files.filter((file) => {
      if (type === "error") {
        return file.startsWith("error-");
      } else if (type === "application") {
        return file.startsWith("application-");
      } else {
        return file.endsWith(".log");
      }
    });

    // Sort log files by date (newest first)
    logFiles.sort((a, b) => {
      const aStats = fs.statSync(path.join(logsDir, a));
      const bStats = fs.statSync(path.join(logsDir, b));
      return bStats.mtime.getTime() - aStats.mtime.getTime();
    });

    // Get the latest log file
    const latestLogFile = logFiles[0];

    if (!latestLogFile) {
      return { logs: [], error: "No log files found" };
    }

    // Read the latest log file
    const logFilePath = path.join(logsDir, latestLogFile);
    const logContent = fs.readFileSync(logFilePath, "utf-8");

    // Split log content into lines
    const logLines = logContent.split("\n").filter(Boolean);

    // Get the last 100 lines
    const lastLines = logLines.slice(-100);

    // Parse log lines into JSON objects
    const parsedLogs = lastLines.map((line) => {
      try {
        // Try to parse as JSON
        return JSON.parse(line);
      } catch {
        // If not JSON, return the raw line
        return { message: line, timestamp: new Date().toISOString() };
      }
    });

    return {
      file: latestLogFile,
      logs: parsedLogs,
      count: parsedLogs.length,
      total: logLines.length,
    };
  } catch (error) {
    console.error("Error getting latest logs:", error);
    return {
      logs: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate test logs for debugging
 */
function generateTestLogs() {
  const requestId = logger.generateRequestId();

  logger.debug("This is a debug message", requestId, { source: "debug-api" });
  logger.info("This is an info message", requestId, { source: "debug-api" });
  logger.http("This is an HTTP message", requestId, { source: "debug-api" });
  logger.warn("This is a warning message", requestId, { source: "debug-api" });
  logger.error("This is an error message", requestId, { source: "debug-api" });

  try {
    throw new Error("Test error");
  } catch (error) {
    logger.error("This is an error with stack trace", requestId, {
      source: "debug-api",
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Apply logging middleware
export default withLogging(handler);

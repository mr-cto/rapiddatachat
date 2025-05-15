import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import {
  get95thPercentileMetrics,
  getRecentMetrics,
} from "../../../lib/nlToSql/performanceMonitoring";

/**
 * API endpoint for getting performance metrics
 * @param req Request object
 * @param res Response object
 * @returns Response with performance metrics
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check authentication
  const session = await getServerSession(req, res, authOptions);

  // In development, allow requests without authentication for testing
  const isDevelopment = process.env.NODE_ENV === "development";
  if ((!session || !session.user) && !isDevelopment) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get performance metrics
    const percentileMetrics = get95thPercentileMetrics();
    const recentMetrics = getRecentMetrics();

    // Calculate average execution time
    const avgExecutionTime =
      recentMetrics.length > 0
        ? recentMetrics.reduce((sum, metric) => sum + metric.executionTime, 0) /
          recentMetrics.length
        : 0;

    // Calculate median execution time
    const sortedExecutionTimes = [...recentMetrics].sort(
      (a, b) => a.executionTime - b.executionTime
    );
    const medianExecutionTime =
      recentMetrics.length > 0
        ? sortedExecutionTimes[Math.floor(sortedExecutionTimes.length / 2)]
            ?.executionTime || 0
        : 0;

    // Return the metrics
    return res.status(200).json({
      percentileMetrics,
      recentMetrics: recentMetrics.slice(0, 10), // Only return the 10 most recent metrics
      stats: {
        count: recentMetrics.length,
        avgExecutionTime,
        medianExecutionTime,
        p95ExecutionTime: percentileMetrics.executionTime,
      },
    });
  } catch (error) {
    console.error("Error getting performance metrics:", error);
    return res.status(500).json({
      error: "Failed to get performance metrics",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

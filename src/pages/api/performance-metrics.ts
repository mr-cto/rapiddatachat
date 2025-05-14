import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { PrismaClient } from "@prisma/client";
import { MetricType } from "../../../lib/batchProcessing/batchProcessingService";

/**
 * API handler for performance metrics
 *
 * GET: Get performance metrics
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
    // Only allow GET requests
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Create Prisma client
    const prisma = new PrismaClient();

    // Get query parameters
    const { jobId, component, metricName, startDate, endDate, limit, offset } =
      req.query;

    // Build filter
    const filter: any = {};

    if (jobId) {
      filter.jobId = jobId as string;
    }

    if (component) {
      filter.component = component as string;
    }

    if (metricName) {
      filter.metricName = metricName as string;
    }

    if (startDate || endDate) {
      filter.timestamp = {};

      if (startDate) {
        filter.timestamp.gte = new Date(startDate as string);
      }

      if (endDate) {
        filter.timestamp.lte = new Date(endDate as string);
      }
    }

    // Get performance metrics
    const metrics = await prisma.performanceMetric.findMany({
      where: filter,
      orderBy: {
        timestamp: "desc",
      },
      take: limit ? parseInt(limit as string) : undefined,
      skip: offset ? parseInt(offset as string) : undefined,
    });

    // Return metrics
    return res.status(200).json(metrics);
  } catch (error) {
    console.error("Error getting performance metrics:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

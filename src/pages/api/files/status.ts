import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "../../../../lib/prisma/replicaClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authOptions";

// Initialize Prisma client
const prisma = getPrismaClient();

/**
 * API endpoint for batch status checks of files
 * Used by the FileStatusMonitor to poll for file status updates
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
    // Get user session for authentication
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get file IDs from query params
    const { ids } = req.query;

    if (!ids) {
      return res.status(400).json({ error: "File IDs are required" });
    }

    // Convert to array if it's a string
    const fileIds = Array.isArray(ids) ? ids : ids.split(",");

    // Get files from database - simplified query to avoid schema issues
    const files = await prisma.file.findMany({
      where: {
        id: { in: fileIds },
        // For simplicity, just check user ID
        userId: session.user?.id,
      },
      select: {
        id: true,
        status: true,
        metadata: true,
        filename: true,
        format: true,
        sizeBytes: true,
        uploadedAt: true,
        ingestedAt: true,
      },
    });

    return res.status(200).json({ files });
  } catch (error) {
    console.error("Error fetching file statuses:", error);
    return res.status(500).json({ error: "Failed to fetch file statuses" });
  }
}

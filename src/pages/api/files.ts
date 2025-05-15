import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { PrismaClient } from "@prisma/client";

// Initialize Prisma client (singleton)
let prismaInstance: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

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

  // Use a default user email for development
  const userEmail =
    session?.user?.email || (isDevelopment ? "dev@example.com" : "");

  try {
    // Get query parameters for pagination, sorting, and filtering
    const {
      page = "1",
      pageSize = "10",
      sortColumn = "uploadedAt",
      sortDirection = "desc",
      status,
    } = req.query;

    // Parse pagination parameters
    const pageNum = parseInt(String(page), 10);
    const pageSizeNum = parseInt(String(pageSize), 10);

    // Validate pagination parameters
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ error: "Page must be a positive integer" });
    }

    if (isNaN(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 100) {
      return res
        .status(400)
        .json({ error: "Page size must be between 1 and 100" });
    }

    // Calculate skip for pagination
    const skip = (pageNum - 1) * pageSizeNum;

    // Build where clause for filtering
    const where: Record<string, unknown> = { userId: userEmail };

    // Add status filter if provided
    if (status) {
      where.status = status;
    }

    // Get Prisma client
    const prisma = getPrismaClient();

    // Get total count for pagination
    const totalCount = await prisma.file.count({ where });

    // Get files with pagination, sorting, and filtering
    const files = await prisma.file.findMany({
      where,
      orderBy: {
        [String(sortColumn)]: sortDirection === "asc" ? "asc" : "desc",
      },
      skip,
      take: pageSizeNum,
      include: {
        _count: {
          select: {
            fileErrors: true,
          },
        },
      },
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSizeNum);

    // Return the files with pagination info
    return res.status(200).json({
      files,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        totalCount,
        totalPages,
      },
      sorting: {
        column: sortColumn,
        direction: sortDirection,
      },
    });
  } catch (error) {
    console.error("Error fetching files:", error);
    return res.status(500).json({
      error: "Failed to fetch files",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

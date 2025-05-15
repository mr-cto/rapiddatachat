import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { PrismaClient } from "@prisma/client";
import { createMergedColumnView } from "../../../lib/columnMergeService";

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

  // Handle different HTTP methods
  switch (req.method) {
    case "GET":
      return handleGetRequest(req, res, userEmail);
    case "POST":
      return handlePostRequest(req, res, userEmail);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

/**
 * Handle GET request to list column merges
 */
async function handleGetRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  userEmail: string
) {
  try {
    // Get query parameters for pagination, sorting, and filtering
    const {
      page = "1",
      pageSize = "10",
      sortColumn = "createdAt",
      sortDirection = "desc",
      fileId,
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

    // Special handling for query results (virtual file)
    if (fileId === "query-results") {
      // For query results, we return an empty array since these are temporary
      return res.status(200).json({
        columnMerges: [],
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          totalCount: 0,
          totalPages: 0,
        },
        sorting: {
          column: sortColumn,
          direction: sortDirection,
        },
      });
    }

    // Build where clause for filtering
    const where: Record<string, unknown> = { userId: userEmail };

    // Add fileId filter if provided
    if (fileId) {
      where.fileId = fileId;
    }

    // Get Prisma client
    const prisma = getPrismaClient();

    // Get total count for pagination
    const totalCount = await prisma.columnMerge.count({ where });

    // Get column merges with pagination, sorting, and filtering
    const columnMerges = await prisma.columnMerge.findMany({
      where,
      orderBy: {
        [String(sortColumn)]: sortDirection === "asc" ? "asc" : "desc",
      },
      skip,
      take: pageSizeNum,
      include: {
        file: {
          select: {
            id: true,
            filename: true,
          },
        },
      },
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSizeNum);

    // Return the column merges with pagination info
    return res.status(200).json({
      columnMerges,
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
    console.error("Error fetching column merges:", error);
    return res.status(500).json({
      error: "Failed to fetch column merges",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle POST request to create a new column merge
 */
async function handlePostRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  userEmail: string
) {
  try {
    const { fileId, mergeName, columnList, delimiter = "" } = req.body;

    // Validate required fields
    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    if (!mergeName) {
      return res.status(400).json({ error: "Merge name is required" });
    }

    if (!columnList || !Array.isArray(columnList) || columnList.length === 0) {
      return res
        .status(400)
        .json({ error: "Column list must be a non-empty array" });
    }

    // Get Prisma client
    const prisma = getPrismaClient();

    // Special handling for query results (virtual file)
    let file = null;

    if (fileId === "query-results") {
      // For query results, we don't need to check for an actual file
      file = {
        id: "query-results",
        userId: userEmail,
        filename: "Query Results",
      };
    } else {
      // Check if the file exists and belongs to the user
      file = await prisma.file.findFirst({
        where: {
          id: fileId,
          userId: userEmail,
        },
      });

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
    }

    // Check if a column merge with the same name already exists for this file
    const existingMerge = await prisma.columnMerge.findFirst({
      where: {
        userId: userEmail,
        fileId,
        mergeName,
      },
    });

    if (existingMerge) {
      return res.status(409).json({
        error: "A column merge with this name already exists for this file",
      });
    }

    // Create the column merge
    let columnMerge;

    if (fileId === "query-results") {
      // For query results, create a temporary column merge object
      // This won't be stored in the database but will be used for the response
      columnMerge = {
        id: `query-results-${Date.now()}`,
        userId: userEmail,
        fileId,
        mergeName,
        columnList,
        delimiter,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      // For regular files, create the column merge in the database
      columnMerge = await prisma.columnMerge.create({
        data: {
          userId: userEmail,
          fileId,
          mergeName,
          columnList,
          delimiter,
        },
      });
    }

    // Create the PostgreSQL view (only for regular files, not query results)
    if (fileId !== "query-results") {
      try {
        const viewResult = await createMergedColumnView({
          id: columnMerge.id,
          userId: userEmail,
          fileId,
          mergeName,
          columnList,
          delimiter,
        });

        if (!viewResult.success) {
          console.warn(`View creation warning: ${viewResult.message}`);
        }
      } catch (viewError) {
        console.error("Error creating view:", viewError);
        // Don't fail the request if view creation fails
        // The view can be created later or manually
      }
    }

    return res.status(201).json({ columnMerge });
  } catch (error) {
    console.error("Error creating column merge:", error);
    return res.status(500).json({
      error: "Failed to create column merge",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

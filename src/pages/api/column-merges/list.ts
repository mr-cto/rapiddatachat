import { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "../../../../lib/middleware/authMiddleware";
import { getConnectionManager } from "../../../../lib/database/connectionManager";
import { v4 as uuidv4 } from "uuid";

export default withAuth(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  // Handle different HTTP methods
  switch (req.method) {
    case "GET":
      return handleGetRequest(req, res, userId);
    case "POST":
      return handlePostRequest(req, res, userId);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
});

/**
 * Handle GET requests to fetch column merges
 */
async function handleGetRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  try {
    // Get query parameters
    const {
      fileId,
      page = "1",
      pageSize = "10",
      sortBy = "createdAt",
      sortDirection = "desc",
    } = req.query;

    // Special handling for preview fileId
    if (fileId === "preview") {
      // Return empty data for preview
      return res.status(200).json({
        columnMerges: [],
        pagination: {
          page: parseInt(page as string),
          pageSize: parseInt(pageSize as string),
          totalCount: 0,
          totalPages: 0,
        },
      });
    }

    // Validate required parameters
    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    // Get connection manager
    const connectionManager = getConnectionManager();
    const replicaClient = connectionManager.getReplicaClient();

    try {
      // Build where clause
      const where = {
        fileId: fileId as string,
        userId,
      };

      // Get total count for pagination
      const totalCount = await replicaClient.columnMerge.count({ where });

      // Get column merges with pagination, sorting, and filtering
      const columnMerges = await replicaClient.columnMerge.findMany({
        where,
        orderBy: {
          [sortBy as string]: sortDirection,
        },
        skip: (parseInt(page as string) - 1) * parseInt(pageSize as string),
        take: parseInt(pageSize as string),
      });

      // Calculate total pages
      const totalPages = Math.ceil(totalCount / parseInt(pageSize as string));

      // Return column merges with pagination info
      return res.status(200).json({
        columnMerges,
        pagination: {
          page: parseInt(page as string),
          pageSize: parseInt(pageSize as string),
          totalCount,
          totalPages,
        },
      });
    } finally {
      // Release the client back to the pool
      connectionManager.releaseReplicaClient(replicaClient);
    }
  } catch (error) {
    console.error("Error fetching column merges:", error);
    return res.status(500).json({
      error: "Failed to fetch column merges",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle POST requests to create column merges
 */
async function handlePostRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  try {
    // Get request body
    const { fileId, mergeName, columnList, delimiter } = req.body;

    // Special handling for preview fileId
    if (fileId === "preview") {
      // Return mock data for preview
      return res.status(200).json({
        columnMerge: {
          id: `preview-${uuidv4()}`,
          userId,
          fileId: "preview",
          mergeName,
          columnList,
          delimiter,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Validate required parameters
    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }
    if (!mergeName) {
      return res.status(400).json({ error: "Merge name is required" });
    }
    if (!columnList || !Array.isArray(columnList) || columnList.length === 0) {
      return res.status(400).json({ error: "Column list is required" });
    }

    // Get connection manager
    const connectionManager = getConnectionManager();
    const replicaClient = connectionManager.getReplicaClient();

    try {
      // Create column merge
      const columnMerge = await replicaClient.columnMerge.create({
        data: {
          userId,
          fileId,
          mergeName,
          columnList,
          delimiter: delimiter || " ",
        },
      });

      // Return created column merge
      return res.status(201).json({ columnMerge });
    } finally {
      // Release the client back to the pool
      connectionManager.releaseReplicaClient(replicaClient);
    }
  } catch (error) {
    console.error("Error creating column merge:", error);
    return res.status(500).json({
      error: "Failed to create column merge",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

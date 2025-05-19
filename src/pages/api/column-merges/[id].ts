import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { PrismaClient } from "@prisma/client";
import { dropMergedColumnView } from "../../../../lib/columnMergeService";
import { getPrismaClient } from "../../../../lib/prisma/replicaClient";


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Get the column merge ID from the URL
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid column merge ID" });
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

  // Get Prisma client
  const prisma = getPrismaClient();

  // Handle different HTTP methods
  switch (req.method) {
    case "GET":
      return handleGetRequest(req, res, id, userEmail, prisma);
    case "PUT":
      return handlePutRequest(req, res, id, userEmail, prisma);
    case "DELETE":
      return handleDeleteRequest(req, res, id, userEmail, prisma);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

/**
 * Handle GET request to fetch a specific column merge
 */
async function handleGetRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  columnMergeId: string,
  userEmail: string,
  prisma: PrismaClient
) {
  try {
    // Special handling for query results (virtual file)
    if (columnMergeId.startsWith("query-results-")) {
      // For query results, we create a virtual column merge object
      const columnMerge = {
        id: columnMergeId,
        userId: userEmail,
        fileId: "query-results",
        mergeName: "Virtual Merge",
        columnList: [],
        delimiter: " ",
        createdAt: new Date(),
        updatedAt: new Date(),
        file: {
          id: "query-results",
          filename: "Query Results",
        },
      };

      return res.status(200).json({ columnMerge });
    }

    // Get the column merge
    const columnMerge = await prisma.columnMerge.findFirst({
      where: {
        id: columnMergeId,
        userId: userEmail,
      },
      include: {
        file: {
          select: {
            id: true,
            filename: true,
          },
        },
      },
    });

    if (!columnMerge) {
      return res.status(404).json({ error: "Column merge not found" });
    }

    return res.status(200).json({ columnMerge });
  } catch (error) {
    console.error("Error fetching column merge:", error);
    return res.status(500).json({
      error: "Failed to fetch column merge",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle PUT request to update a column merge
 */
async function handlePutRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  columnMergeId: string,
  userEmail: string,
  prisma: PrismaClient
) {
  try {
    const { mergeName, columnList, delimiter } = req.body;

    // Validate required fields
    if (!mergeName) {
      return res.status(400).json({ error: "Merge name is required" });
    }

    if (!columnList || !Array.isArray(columnList) || columnList.length === 0) {
      return res
        .status(400)
        .json({ error: "Column list must be a non-empty array" });
    }

    // Check if the column merge exists and belongs to the user
    const existingMerge = await prisma.columnMerge.findFirst({
      where: {
        id: columnMergeId,
        userId: userEmail,
      },
      include: {
        file: true,
      },
    });

    if (!existingMerge) {
      return res.status(404).json({ error: "Column merge not found" });
    }

    // Check if another column merge with the same name exists for this file (excluding this one)
    const duplicateMerge = await prisma.columnMerge.findFirst({
      where: {
        userId: userEmail,
        fileId: existingMerge.fileId,
        mergeName,
        id: { not: columnMergeId },
      },
    });

    if (duplicateMerge) {
      return res.status(409).json({
        error:
          "Another column merge with this name already exists for this file",
      });
    }

    // Update the column merge
    const updatedColumnMerge = await prisma.columnMerge.update({
      where: {
        id: columnMergeId,
      },
      data: {
        mergeName,
        columnList,
        delimiter: delimiter || " ",
        updatedAt: new Date(),
      },
      include: {
        file: {
          select: {
            id: true,
            filename: true,
          },
        },
      },
    });

    return res.status(200).json({ columnMerge: updatedColumnMerge });
  } catch (error) {
    console.error("Error updating column merge:", error);
    return res.status(500).json({
      error: "Failed to update column merge",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle DELETE request to delete a column merge
 */
async function handleDeleteRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  columnMergeId: string,
  userEmail: string,
  prisma: PrismaClient
) {
  try {
    // Special handling for query results (virtual file)
    if (columnMergeId.startsWith("query-results-")) {
      // For query results, we don't need to delete anything from the database
      return res
        .status(200)
        .json({ message: "Column merge deleted successfully" });
    }

    // Check if the column merge exists and belongs to the user
    const columnMerge = await prisma.columnMerge.findFirst({
      where: {
        id: columnMergeId,
        userId: userEmail,
      },
    });

    if (!columnMerge) {
      return res.status(404).json({ error: "Column merge not found" });
    }

    // Drop the PostgreSQL view
    try {
      const viewResult = await dropMergedColumnView({
        id: columnMergeId,
        userId: userEmail,
        fileId: columnMerge.fileId,
        mergeName: columnMerge.mergeName,
        columnList: columnMerge.columnList,
        delimiter: columnMerge.delimiter,
      });

      if (!viewResult.success) {
        console.warn(`View deletion warning: ${viewResult.message}`);
      }
    } catch (viewError) {
      console.error("Error dropping view:", viewError);
      // Don't fail the request if view deletion fails
    }

    // Delete the column merge
    await prisma.columnMerge.delete({
      where: {
        id: columnMergeId,
      },
    });

    return res
      .status(200)
      .json({ message: "Column merge deleted successfully" });
  } catch (error) {
    console.error("Error deleting column merge:", error);
    return res.status(500).json({
      error: "Failed to delete column merge",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

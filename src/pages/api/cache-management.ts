import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import sharedQueryCache from "../../../lib/sharedQueryCache";
import { authOptions } from "../../../lib/authOptions";

/**
 * API endpoint for cache management
 * @param req NextApiRequest
 * @param res NextApiResponse
 * @returns Promise<void>
 */
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
 * Handle GET requests for cache statistics
 * @param req NextApiRequest
 * @param res NextApiResponse
 * @param userEmail User email
 * @returns Promise<void>
 */
async function handleGetRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  userEmail: string
) {
  try {
    // Get cache statistics
    const stats = sharedQueryCache.getStats();

    // Get user's shared queries
    const userQueries = sharedQueryCache.getUserSharedQueries(userEmail);

    return res.status(200).json({
      stats,
      userQueries: userQueries.map((q) => ({
        id: q.id,
        naturalLanguageQuery: q.naturalLanguageQuery,
        timestamp: q.timestamp,
        expiresAt: q.expiresAt,
        accessCount: q.accessCount,
      })),
      userQueryCount: userQueries.length,
    });
  } catch (error) {
    console.error("Error getting cache statistics:", error);
    return res.status(500).json({
      error: "Failed to get cache statistics",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle POST requests for cache management operations
 * @param req NextApiRequest
 * @param res NextApiResponse
 * @param userEmail User email
 * @returns Promise<void>
 */
async function handlePostRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  userEmail: string
) {
  try {
    const { action, id, count } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Action is required" });
    }

    switch (action) {
      case "clear":
        // Clear the entire cache
        sharedQueryCache.clear();
        return res.status(200).json({
          message: "Cache cleared successfully",
        });

      case "prune":
        // Prune the cache
        sharedQueryCache.prune(count);
        return res.status(200).json({
          message: "Cache pruned successfully",
          stats: sharedQueryCache.getStats(),
        });

      case "delete":
        // Delete a specific item from the cache
        if (!id) {
          return res
            .status(400)
            .json({ error: "ID is required for delete action" });
        }

        // Check if the user owns this shared query or is an admin
        const query = sharedQueryCache.get(id);
        if (!query) {
          return res.status(404).json({ error: "Shared query not found" });
        }

        // In a real app, check if user is admin or owner
        if (query.userId !== userEmail && !isDevelopmentOrAdmin(userEmail)) {
          return res
            .status(403)
            .json({ error: "Not authorized to delete this shared query" });
        }

        const deleted = sharedQueryCache.delete(id);
        return res.status(200).json({
          message: deleted
            ? "Shared query deleted successfully"
            : "Failed to delete shared query",
          success: deleted,
        });

      default:
        return res.status(400).json({ error: "Invalid action" });
    }
  } catch (error) {
    console.error("Error managing cache:", error);
    return res.status(500).json({
      error: "Failed to manage cache",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Check if the user is an admin or in development mode
 * @param userEmail User email
 * @returns boolean
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isDevelopmentOrAdmin(_userEmail: string): boolean {
  // In a real app, check if user is admin based on email
  // For now, just check if in development mode
  return process.env.NODE_ENV === "development";
}

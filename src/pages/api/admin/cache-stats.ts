import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { schemaCache } from "../../../../lib/schemaCacheService";

// List of admin emails
const ADMIN_EMAILS = [
  "admin@example.com",
  // Add more admin emails as needed
];

/**
 * API handler for cache statistics
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check authentication
  const session = await getServerSession(req, res, authOptions);

  // Require authentication for all requests
  if (!session || !session.user || !session.user.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Check if the user is an admin
  const isAdmin =
    session.user.email && ADMIN_EMAILS.includes(session.user.email);
  if (!isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    // Handle different HTTP methods
    switch (req.method) {
      case "GET":
        return handleGetCacheStats(req, res);

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error in cache-stats API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle GET requests for cache statistics
 */
async function handleGetCacheStats(req: NextApiRequest, res: NextApiResponse) {
  // Get cache statistics
  const stats = schemaCache.getStats();

  // Get cache keys
  const keys = schemaCache.keys();

  return res.status(200).json({
    stats,
    keys,
  });
}

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
 * API handler for clearing a specific cache key
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

  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    return await handleClearCacheKey(req, res);
  } catch (error) {
    console.error("Error in clear-cache-key API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle POST requests for clearing a specific cache key
 */
async function handleClearCacheKey(req: NextApiRequest, res: NextApiResponse) {
  const { key } = req.body;

  if (!key) {
    return res.status(400).json({ error: "Cache key is required" });
  }

  // Delete the key from the cache
  const deleted = schemaCache.delete(key);

  if (deleted > 0) {
    return res.status(200).json({
      success: true,
      message: `Cache key '${key}' cleared successfully`,
    });
  } else {
    return res.status(404).json({
      success: false,
      error: `Cache key '${key}' not found`,
    });
  }
}

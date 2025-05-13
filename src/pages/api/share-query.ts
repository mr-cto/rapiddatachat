import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import sharedQueryCache, {
  SharedQueryData,
} from "../../../lib/sharedQueryCache";

/**
 * API endpoint for sharing query results
 * @param req NextApiRequest
 * @param res NextApiResponse
 * @returns Promise<void>
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== "POST") {
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
    const { queryId, naturalLanguageQuery, sqlQuery, results, columnMerges } =
      req.body;

    if (!naturalLanguageQuery || !sqlQuery || !results) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Generate a unique share ID if not provided
    const shareId =
      queryId ||
      `share-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Create the shared query data
    const sharedQueryData: SharedQueryData = {
      id: shareId,
      naturalLanguageQuery,
      sqlQuery,
      results,
      timestamp: new Date(),
      userId: userEmail,
      accessCount: 0,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days expiration
      columnMerges: columnMerges || [],
    };

    // Store in cache
    const cached = sharedQueryCache.set(shareId, sharedQueryData);

    if (!cached) {
      // If cache is full, prune it and try again
      sharedQueryCache.prune();
      const retryCache = sharedQueryCache.set(shareId, sharedQueryData);

      if (!retryCache) {
        return res.status(500).json({
          error: "Failed to cache shared query",
          details: "Cache is full and pruning did not free enough space",
        });
      }
    }

    // Store the shared query in the database (for persistence)
    try {
      // In a production environment, we would store this in a database
      // For now, we'll rely on the in-memory cache
      // Example of how this might be implemented with a database:
      /*
      await executeQuery(`
        INSERT INTO shared_queries (
          id, user_id, natural_language_query, sql_query, results, created_at, expires_at, column_merges
        ) VALUES (
          '${shareId}',
          '${userEmail}',
          '${naturalLanguageQuery.replace(/'/g, "''")}',
          '${sqlQuery.replace(/'/g, "''")}',
          '${JSON.stringify(results).replace(/'/g, "''")}',
          CURRENT_TIMESTAMP,
          DATETIME(CURRENT_TIMESTAMP, '+30 days'),
          '${JSON.stringify(columnMerges || []).replace(/'/g, "''")}'
        )
      `);
      */
    } catch (dbError) {
      console.error("Database error when storing shared query:", dbError);
      // Continue anyway since we have the cache
    }

    // Generate the share URL
    const shareUrl = `${req.headers.origin}/shared/${shareId}`;

    // Return the share URL and cache stats
    return res.status(200).json({
      shareId,
      shareUrl,
      message: "Query shared successfully",
      cacheStats: sharedQueryCache.getStats(),
      expiresAt: sharedQueryData.expiresAt,
    });
  } catch (error) {
    console.error("Error sharing query:", error);
    return res.status(500).json({
      error: "Failed to share query",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

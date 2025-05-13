import { NextApiRequest, NextApiResponse } from "next";
import sharedQueryCache from "../../../../lib/sharedQueryCache";
import { executeQuery } from "../../../../lib/database";

/**
 * API endpoint for retrieving shared query data
 * @param req NextApiRequest
 * @param res NextApiResponse
 * @returns Promise<void>
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: "Invalid share ID" });
  }

  try {
    // Try to get the shared query from cache
    const cachedQuery = sharedQueryCache.get(id);

    if (cachedQuery) {
      // Return the cached query
      return res.status(200).json(cachedQuery);
    }

    // If not in cache, try to get from database

    const result = (await executeQuery(`
      SELECT * FROM shared_queries WHERE id = '${id}'
    `)) as Array<Record<string, any>>;

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Shared query not found" });
    }

    const dbQuery = result[0];

    // Parse the results JSON if stored as a string
    const parsedResults =
      typeof dbQuery.results === "string"
        ? JSON.parse(dbQuery.results)
        : dbQuery.results;

    // Parse the column merges JSON if stored as a string
    const parsedColumnMerges =
      typeof dbQuery.column_merges === "string"
        ? JSON.parse(dbQuery.column_merges)
        : dbQuery.column_merges || [];

    // Create a SharedQueryData object
    const sharedQuery = {
      id: dbQuery.id,
      naturalLanguageQuery: dbQuery.natural_language_query,
      sqlQuery: dbQuery.sql_query,
      results: parsedResults,
      timestamp: new Date(dbQuery.created_at),
      executionTime: dbQuery.execution_time,
      userId: dbQuery.user_id,
      expiresAt: dbQuery.expires_at ? new Date(dbQuery.expires_at) : undefined,
      accessCount: 0,
      columnMerges: parsedColumnMerges,
    };

    // Add to cache for future requests
    sharedQueryCache.set(id, sharedQuery);

    return res.status(200).json(sharedQuery);
  } catch (error) {
    console.error("Error retrieving shared query:", error);
    return res.status(500).json({
      error: "Failed to retrieve shared query",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

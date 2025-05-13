import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { createNLToSQLService } from "../../../lib/nlToSql";

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
    // Get the limit from the query parameters
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 10;

    // Create the NL-to-SQL service
    const nlToSqlService = createNLToSQLService();

    // Get the query history
    console.log(
      `[QueryHistory] Fetching history for user: ${userEmail}, limit: ${limit}`
    );
    const history = await nlToSqlService.getQueryHistory(userEmail, limit);
    console.log(`[QueryHistory] Found ${history.length} history items`);

    // Log the first item for debugging
    if (history.length > 0) {
      console.log(`[QueryHistory] Sample item:`, JSON.stringify(history[0]));
    }

    // Return the history
    return res.status(200).json({ history });
  } catch (error) {
    console.error("Error getting query history:", error);
    return res.status(500).json({
      error: "Failed to get query history",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

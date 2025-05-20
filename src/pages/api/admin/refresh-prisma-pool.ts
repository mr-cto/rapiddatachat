import { NextApiRequest, NextApiResponse } from "next";
import { getConnectionManager } from "../../../../lib/database/connectionManager";

/**
 * API endpoint to refresh the Prisma connection pool
 * This is useful after schema changes to ensure all clients have the latest schema
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get the connection manager
    const connectionManager = getConnectionManager();

    // Close all connections
    await connectionManager.closeAllConnections();

    return res.status(200).json({
      success: true,
      message: "Prisma connection pool refreshed successfully",
    });
  } catch (error) {
    console.error("Error refreshing Prisma connection pool:", error);
    return res.status(500).json({
      error: "Failed to refresh Prisma connection pool",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

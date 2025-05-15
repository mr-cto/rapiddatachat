import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import {
  getActivationProgress,
  fileExistsForUser,
} from "../../../../lib/fileActivationCompat";
import { authOptions } from "../../../../lib/authOptions";

/**
 * API handler for file activation progress (compatibility endpoint)
 *
 * This endpoint is maintained for backward compatibility with existing code.
 * In the simplified upload flow, files are automatically activated after upload.
 */
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
    const { id } = req.query;
    const fileId = Array.isArray(id) ? id[0] : id;
    const userId = userEmail || "";

    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    // Check if file belongs to user
    if (!(await fileExistsForUser(fileId, userId))) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get activation progress using compatibility layer
    const progress = await getActivationProgress(fileId);

    if (!progress) {
      return res.status(404).json({ error: "File not found" });
    }

    return res.status(200).json({
      fileId,
      progress: progress.progress,
      startedAt: progress.startedAt,
      completedAt: progress.completedAt,
      error: progress.error,
      isComplete: progress.completedAt !== null,
    });
  } catch (error) {
    console.error("Error getting file activation progress:", error);

    return res.status(500).json({
      error: "Failed to get file activation progress",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

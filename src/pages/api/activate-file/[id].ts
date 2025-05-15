import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { activateFile } from "../../../../lib/fileActivation";

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
    const { id } = req.query;
    const fileId = Array.isArray(id) ? id[0] : id;
    const userId = userEmail || "";

    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    // Activate the file
    const result = await activateFile(fileId, userId);

    if (!result.success) {
      // Map common error messages to appropriate HTTP status codes
      if (
        result.message === "File not found" ||
        result.message === "File data not found"
      ) {
        return res.status(404).json({ error: result.message });
      } else if (result.message === "Access denied") {
        return res.status(403).json({ error: result.message });
      } else {
        return res.status(500).json({ error: result.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      fileId,
      status: "active",
      dbOperationsSkipped: result.dbOperationsSkipped,
    });
  } catch (error) {
    console.error("File activation error:", error);

    return res.status(500).json({
      error: "Failed to activate file",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

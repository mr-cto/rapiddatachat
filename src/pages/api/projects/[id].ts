import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { ProjectService } from "../../../../lib/project/projectService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  const isDevelopment = process.env.NODE_ENV === "development";

  if ((!session || !session.user) && !isDevelopment) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Use a default user email for development
  // Check for test user email header (for testing purposes only)
  const testUserEmail = isDevelopment ? req.headers["x-test-user-email"] : null;
  const userEmail =
    session?.user?.email || (isDevelopment ? "dev@example.com" : "");
  const userId = testUserEmail ? String(testUserEmail) : userEmail || "unknown";

  // Get project ID from URL
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid project ID" });
  }

  try {
    // Get project by ID
    const projectService = new ProjectService();
    const project = await projectService.getProjectById(id);

    // Check if project exists
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if project belongs to user
    if (project.userId !== userId) {
      return res.status(403).json({
        error: "Forbidden - You don't have permission to access this project",
      });
    }

    // Return project data
    return res.status(200).json({ project });
  } catch (error) {
    console.error(`Error getting project ${id}:`, error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

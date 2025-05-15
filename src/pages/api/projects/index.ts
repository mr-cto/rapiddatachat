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

  const projectService = new ProjectService();

  // Handle different HTTP methods
  switch (req.method) {
    case "GET":
      try {
        // Get all projects for the user
        const projects = await projectService.getProjects(userId);
        return res.status(200).json({ projects });
      } catch (error) {
        console.error("Error getting projects:", error);
        return res.status(500).json({ error: "Internal server error" });
      }

    case "POST":
      try {
        // Extract project data from request body
        const { name, description } = req.body;

        if (!name) {
          return res.status(400).json({ error: "Project name is required" });
        }

        // Create a new project
        const project = await projectService.createProject(
          userId,
          name,
          description
        );

        return res.status(201).json({ project });
      } catch (error) {
        console.error("Error creating project:", error);
        return res.status(500).json({ error: "Internal server error" });
      }

    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

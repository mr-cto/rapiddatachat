import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { ProjectService } from "../../../../../lib/project/projectService";

/**
 * API handler for project files
 * GET: Get all files for a project
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Get the user session
  const session = await getServerSession(req, res, authOptions);

  // Check if the user is authenticated
  if (!session || !session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id as string;
  const projectService = new ProjectService();

  // Get the project ID from the URL
  const { id } = req.query;
  const projectId = Array.isArray(id) ? id[0] : id;

  if (!projectId) {
    return res.status(400).json({ error: "Project ID is required" });
  }

  try {
    // Check if the project exists and belongs to the user
    const project = await projectService.getProjectById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Handle GET request (get all files for a project)
    if (req.method === "GET") {
      // Get all files for the project using the ProjectService
      const files = await projectService.getProjectFiles(projectId);

      return res.status(200).json({ files });
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error(`[API] Error in project/${projectId}/files endpoint:`, error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

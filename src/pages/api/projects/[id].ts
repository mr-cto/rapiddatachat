import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { ProjectService } from "../../../../lib/project/projectService";

/**
 * API handler for project-specific operations
 * GET: Get project details
 * PUT: Update project details
 * DELETE: Delete a project
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
    // Handle GET request (get project details)
    if (req.method === "GET") {
      const project = await projectService.getProjectById(projectId);

      // Check if the project exists
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Check if the project belongs to the user
      if (project.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      return res.status(200).json({ project });
    }

    // Handle PUT request (update project details)
    if (req.method === "PUT") {
      const { name, description } = req.body;

      // Validate required fields
      if (!name) {
        return res.status(400).json({ error: "Project name is required" });
      }

      // Get the existing project
      const existingProject = await projectService.getProjectById(projectId);

      // Check if the project exists
      if (!existingProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Check if the project belongs to the user
      if (existingProject.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Update the project
      const updatedProject = await projectService.updateProject({
        ...existingProject,
        name,
        description,
      });

      return res.status(200).json({ project: updatedProject });
    }

    // Handle DELETE request (delete a project)
    if (req.method === "DELETE") {
      // Get the existing project
      const existingProject = await projectService.getProjectById(projectId);

      // Check if the project exists
      if (!existingProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Check if the project belongs to the user
      if (existingProject.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Delete the project
      const success = await projectService.deleteProject(projectId);

      if (!success) {
        return res.status(500).json({ error: "Failed to delete project" });
      }

      return res.status(200).json({ success: true });
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error(`[API] Error in project/${projectId} endpoint:`, error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

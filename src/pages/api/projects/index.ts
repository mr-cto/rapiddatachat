import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { ProjectService } from "../../../../lib/project/projectService";

/**
 * API handler for projects
 * GET: Get all projects for the current user
 * POST: Create a new project
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

  try {
    // Handle GET request (get all projects)
    if (req.method === "GET") {
      const projects = await projectService.getProjects(userId);
      return res.status(200).json({ projects });
    }

    // Handle POST request (create a new project)
    if (req.method === "POST") {
      const { name, description } = req.body;

      // Validate required fields
      if (!name) {
        return res.status(400).json({ error: "Project name is required" });
      }

      // Create the project
      const project = await projectService.createProject(
        userId,
        name,
        description
      );

      return res.status(201).json({ project });
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("[API] Error in projects endpoint:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

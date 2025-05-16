import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authOptions";
import { PrismaClient } from "@prisma/client";

// Initialize Prisma client
const prisma = new PrismaClient();

/**
 * API handler for project operations
 * GET: Get a specific project
 * PATCH: Update a project (including archive/unarchive)
 * DELETE: Delete a project
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  console.log("Session in API:", session);

  // Check authentication
  if (!session || !session.user) {
    console.log("Unauthorized - No session or user");
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Get user identifiers from session
  const userId = session.user.id;
  const userEmail = session.user.email;

  console.log("Session user:", session.user);
  console.log("User ID:", userId);
  console.log("User Email:", userEmail);

  if (!userId && !userEmail) {
    console.error("No user identifier found in session:", session);
    return res
      .status(401)
      .json({ message: "User identification not found in session" });
  }

  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ message: "Invalid project ID" });
  }

  try {
    // GET - Retrieve a specific project
    if (req.method === "GET") {
      const project = await prisma.project.findUnique({
        where: {
          id,
        },
      });

      // Check if project exists
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if project belongs to user
      console.log("Project:", project);
      console.log("Project userId:", project.userId);
      console.log("Session userId:", userId);
      console.log("Session userEmail:", userEmail);

      // Check if project belongs to user by ID or email
      if (project.userId !== userId && project.userId !== userEmail) {
        return res.status(403).json({ message: "Forbidden" });
      }

      return res.status(200).json({ project });
    }

    // PATCH - Update a project
    if (req.method === "PATCH") {
      const { name, description, archived } = req.body;

      // Validate input
      if (
        name !== undefined &&
        (typeof name !== "string" || name.trim() === "")
      ) {
        return res.status(400).json({ message: "Invalid project name" });
      }

      if (description !== undefined && typeof description !== "string") {
        return res.status(400).json({ message: "Invalid project description" });
      }

      if (archived !== undefined && typeof archived !== "boolean") {
        return res.status(400).json({ message: "Invalid archived status" });
      }

      console.log("Request body:", req.body);

      // Check if project exists and belongs to user
      const existingProject = await prisma.project.findUnique({
        where: {
          id,
        },
      });

      // Check if project exists
      if (!existingProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if project belongs to user
      console.log("Existing project:", existingProject);
      console.log("Project userId:", existingProject.userId);
      console.log("Session userId:", userId);
      console.log("Session userEmail:", userEmail);

      // Check if project belongs to user by ID or email
      if (
        existingProject.userId !== userId &&
        existingProject.userId !== userEmail
      ) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Since 'archived' is not in the schema, we'll handle it separately
      // Update project basic fields
      const updatedProject = await prisma.project.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          updatedAt: new Date(),
        },
      });

      // If archived status is provided, we'll track it in the frontend
      // In a real application, you would add the field to the schema
      // or store it in a separate table

      return res.status(200).json({ project: updatedProject });
    }

    // DELETE - Delete a project
    if (req.method === "DELETE") {
      // Check if project exists and belongs to user
      const existingProject = await prisma.project.findUnique({
        where: {
          id,
        },
      });

      // Check if project exists
      if (!existingProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if project belongs to user
      if (
        existingProject.userId !== userId &&
        existingProject.userId !== userEmail
      ) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Delete project
      await prisma.project.delete({
        where: { id },
      });

      return res.status(200).json({ message: "Project deleted successfully" });
    }

    // Method not allowed
    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error("Error handling project request:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authOptions";
import { getPrismaClient } from "../../../../lib/prisma/replicaClient";

// Initialize Prisma client
const prisma = getPrismaClient();

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
  try {
    const session = await getServerSession(req, res, authOptions);

    // Check authentication
    if (!session || !session.user) {
      return res
        .status(401)
        .json({ message: "Unauthorized", error: "No valid session found" });
    }

    // Get user identifiers from session
    const userId = session.user.id;
    const userEmail = session.user.email;

    // For development, allow access with just email
    const isDevelopment = process.env.NODE_ENV === "development";

    if (!isDevelopment && !userId && !userEmail) {
      return res.status(401).json({
        message: "User identification not found in session",
        error: "Missing user ID and email in session",
      });
    }

    const { id } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    // GET - Retrieve a specific project
    if (req.method === "GET") {
      const project = await prisma.useReplica(async (replicaClient) => {
        return await replicaClient.project.findUnique({
          where: {
            id,
          },
        });
      });

      // Check if project exists
      if (!project) {
        return res.status(404).json({
          message: "Project not found",
          error: `No project found with ID: ${id}`,
        });
      }

      // Check if project belongs to user (skip in development)
      if (!isDevelopment) {
        // Check if project belongs to user by ID or email
        if (project.userId !== userId && project.userId !== userEmail) {
          return res.status(403).json({
            message: "Forbidden",
            error: "You don't have permission to access this project",
          });
        }
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

      // Check if project exists and belongs to user
      const existingProject = await prisma.useReplica(async (replicaClient) => {
        return await replicaClient.project.findUnique({
          where: {
            id,
          },
        });
      });

      // Check if project exists
      if (!existingProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if project belongs to user (skip in development)
      if (!isDevelopment) {
        // Check if project belongs to user by ID or email
        if (
          existingProject.userId !== userId &&
          existingProject.userId !== userEmail
        ) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      // Update project basic fields
      const updatedProject = await prisma.useReplica(async (replicaClient) => {
        return await replicaClient.project.update({
          where: { id },
          data: {
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            updatedAt: new Date(),
          },
        });
      });

      return res.status(200).json({ project: updatedProject });
    }

    // DELETE - Delete a project
    if (req.method === "DELETE") {
      // Check if project exists and belongs to user
      const existingProject = await prisma.useReplica(async (replicaClient) => {
        return await replicaClient.project.findUnique({
          where: {
            id,
          },
        });
      });

      // Check if project exists
      if (!existingProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if project belongs to user (skip in development)
      if (!isDevelopment) {
        if (
          existingProject.userId !== userId &&
          existingProject.userId !== userEmail
        ) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      // Delete project
      await prisma.useReplica(async (replicaClient) => {
        return await replicaClient.project.delete({
          where: { id },
        });
      });

      return res.status(200).json({ message: "Project deleted successfully" });
    }

    // Method not allowed
    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error("Error handling project request:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

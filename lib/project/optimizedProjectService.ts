import { PrismaClient, Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { getConnectionManager } from "../database/connectionManager";
import { Project } from "./projectService";

/**
 * Optimized ProjectService that eliminates redundant table existence checks
 * and uses Prisma's built-in error handling
 */
export class OptimizedProjectService {
  /**
   * Create a new project
   * @param userId User ID
   * @param name Project name
   * @param description Project description
   * @returns Promise<Project> Created project
   */
  static async createProject(
    userId: string,
    name: string,
    description?: string
  ): Promise<Project> {
    try {
      console.log(
        `[OptimizedProjectService] Creating project "${name}" for user: ${userId}`
      );

      // Get connection manager
      const connectionManager = getConnectionManager();

      // Get a replica client from the pool
      const replicaClient = connectionManager.getReplicaClient();

      try {
        // Generate a UUID for the project
        const projectId = uuidv4();

        // Create the project using Prisma
        const project = await replicaClient.project.create({
          data: {
            id: projectId,
            userId,
            name,
            description: description || null,
          },
        });

        console.log(`[OptimizedProjectService] Created project: ${project.id}`);

        // Return the project in the expected format
        return {
          id: project.id,
          userId: project.userId,
          name: project.name,
          description: project.description || undefined,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        };
      } finally {
        // Release the client back to the pool
        connectionManager.releaseReplicaClient(replicaClient);
      }
    } catch (error) {
      console.error("[OptimizedProjectService] Error creating project:", error);
      throw error;
    }
  }

  /**
   * Get all projects for a user
   * @param userId User ID
   * @returns Promise<Project[]> Projects
   */
  static async getProjects(userId: string): Promise<Project[]> {
    try {
      // Get connection manager
      const connectionManager = getConnectionManager();

      // Get a replica client from the pool
      const replicaClient = connectionManager.getReplicaClient();

      try {
        // Get all projects for the user using Prisma
        const projects = await replicaClient.project.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
        });

        console.log(
          `[OptimizedProjectService] Found ${projects.length} projects for user: ${userId}`
        );

        // Return the projects in the expected format
        return projects.map((project) => ({
          id: project.id,
          userId: project.userId,
          name: project.name,
          description: project.description || undefined,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        }));
      } finally {
        // Release the client back to the pool
        connectionManager.releaseReplicaClient(replicaClient);
      }
    } catch (error) {
      // Handle specific Prisma errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2021") {
          // Table not found error
          console.warn(
            `[OptimizedProjectService] Table not found: ${error.message}`
          );
          return [];
        }
      }

      console.error("[OptimizedProjectService] Error getting projects:", error);
      return [];
    }
  }

  /**
   * Get a project by ID
   * @param projectId Project ID
   * @returns Promise<Project | null> Project or null if not found
   */
  static async getProjectById(projectId: string): Promise<Project | null> {
    try {
      // Get connection manager
      const connectionManager = getConnectionManager();

      // Get a replica client from the pool
      const replicaClient = connectionManager.getReplicaClient();

      try {
        // Get the project using Prisma
        const project = await replicaClient.project.findUnique({
          where: { id: projectId },
        });

        if (!project) {
          console.log(
            `[OptimizedProjectService] Project ${projectId} not found`
          );
          return null;
        }

        // Return the project in the expected format
        return {
          id: project.id,
          userId: project.userId,
          name: project.name,
          description: project.description || undefined,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        };
      } finally {
        // Release the client back to the pool
        connectionManager.releaseReplicaClient(replicaClient);
      }
    } catch (error) {
      // Handle specific Prisma errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2021") {
          // Table not found error
          console.warn(
            `[OptimizedProjectService] Table not found: ${error.message}`
          );
          return null;
        }
      }

      console.error(
        `[OptimizedProjectService] Error getting project ${projectId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Update a project
   * @param project Project to update
   * @returns Promise<Project | null> Updated project or null if failed
   */
  static async updateProject(project: Project): Promise<Project | null> {
    try {
      // Get connection manager
      const connectionManager = getConnectionManager();

      // Get a replica client from the pool
      const replicaClient = connectionManager.getReplicaClient();

      try {
        // Update the project using Prisma
        const updatedProject = await replicaClient.project.update({
          where: { id: project.id },
          data: {
            name: project.name,
            description: project.description || null,
          },
        });

        console.log(
          `[OptimizedProjectService] Updated project: ${updatedProject.id}`
        );

        // Return the updated project in the expected format
        return {
          id: updatedProject.id,
          userId: updatedProject.userId,
          name: updatedProject.name,
          description: updatedProject.description || undefined,
          createdAt: updatedProject.createdAt,
          updatedAt: updatedProject.updatedAt,
        };
      } finally {
        // Release the client back to the pool
        connectionManager.releaseReplicaClient(replicaClient);
      }
    } catch (error) {
      // Handle specific Prisma errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          // Record not found error
          console.warn(
            `[OptimizedProjectService] Project ${project.id} not found for update`
          );
          return null;
        }
        if (error.code === "P2021") {
          // Table not found error
          console.warn(
            `[OptimizedProjectService] Table not found: ${error.message}`
          );
          return null;
        }
      }

      console.error(
        `[OptimizedProjectService] Error updating project ${project.id}:`,
        error
      );
      return null;
    }
  }

  /**
   * Delete a project
   * @param projectId Project ID
   * @returns Promise<boolean> True if deleted successfully
   */
  static async deleteProject(projectId: string): Promise<boolean> {
    try {
      // Get connection manager
      const connectionManager = getConnectionManager();

      // Get a replica client from the pool
      const replicaClient = connectionManager.getReplicaClient();

      try {
        // Delete the project using Prisma
        await replicaClient.project.delete({
          where: { id: projectId },
        });

        console.log(`[OptimizedProjectService] Deleted project: ${projectId}`);
        return true;
      } finally {
        // Release the client back to the pool
        connectionManager.releaseReplicaClient(replicaClient);
      }
    } catch (error) {
      // Handle specific Prisma errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          // Record not found error
          console.warn(
            `[OptimizedProjectService] Project ${projectId} not found for deletion`
          );
          return false;
        }
        if (error.code === "P2021") {
          // Table not found error
          console.warn(
            `[OptimizedProjectService] Table not found: ${error.message}`
          );
          return false;
        }
      }

      console.error(
        `[OptimizedProjectService] Error deleting project ${projectId}:`,
        error
      );
      return false;
    }
  }
}

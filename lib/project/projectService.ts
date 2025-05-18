import { executeQuery } from "../database";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "../prisma/replicaClient";

/**
 * Interface for a project
 */
export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ProjectService class for managing projects
 */
export class ProjectService {
  /**
   * Create a new project
   * @param userId User ID
   * @param name Project name
   * @param description Project description
   * @returns Promise<Project> Created project
   */
  async createProject(
    userId: string,
    name: string,
    description?: string
  ): Promise<Project> {
    try {
      // Use the optimized service that doesn't use table existence checks
      const { OptimizedProjectService } = await import(
        "./optimizedProjectService"
      );
      return OptimizedProjectService.createProject(userId, name, description);
    } catch (error) {
      console.error("[ProjectService] Error creating project:", error);
      throw error;
    }
  }

  /**
   * Get all projects for a user
   * @param userId User ID
   * @returns Promise<Project[]> Projects
   */
  async getProjects(userId: string): Promise<Project[]> {
    try {
      // Use the optimized service that doesn't use table existence checks
      const { OptimizedProjectService } = await import(
        "./optimizedProjectService"
      );
      return OptimizedProjectService.getProjects(userId);
    } catch (error) {
      console.error("[ProjectService] Error getting projects:", error);
      return [];
    }
  }

  /**
   * Get a project by ID
   * @param projectId Project ID
   * @returns Promise<Project | null> Project or null if not found
   */
  async getProjectById(projectId: string): Promise<Project | null> {
    try {
      // Use the optimized service that doesn't use table existence checks
      const { OptimizedProjectService } = await import(
        "./optimizedProjectService"
      );
      return OptimizedProjectService.getProjectById(projectId);
    } catch (error) {
      console.error(
        `[ProjectService] Error getting project ${projectId}:`,
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
  async updateProject(project: Project): Promise<Project | null> {
    try {
      // Use the optimized service that doesn't use table existence checks
      const { OptimizedProjectService } = await import(
        "./optimizedProjectService"
      );
      return OptimizedProjectService.updateProject(project);
    } catch (error) {
      console.error(
        `[ProjectService] Error updating project ${project.id}:`,
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
  async deleteProject(projectId: string): Promise<boolean> {
    try {
      // Use the optimized service that doesn't use table existence checks
      const { OptimizedProjectService } = await import(
        "./optimizedProjectService"
      );
      return OptimizedProjectService.deleteProject(projectId);
    } catch (error) {
      console.error(
        `[ProjectService] Error deleting project ${projectId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Get all files for a project
   * @param projectId Project ID
   * @returns Promise<any[]> Files
   */
  /**
   * Get all files for a project
   * @param projectId Project ID
   * @returns Promise<any[]> Files
   */
  async getProjectFiles(projectId: string): Promise<any[]> {
    try {
      // Use the optimized ProjectFilesService for file retrieval
      const { ProjectFilesService } = await import("./projectFilesService");
      return ProjectFilesService.getProjectFiles(projectId);
    } catch (error) {
      console.error(
        `[ProjectService] Error getting files for project ${projectId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Add a file to a project
   * @param projectId Project ID
   * @param fileId File ID
   * @returns Promise<boolean> True if added successfully
   */
  async addFileToProject(projectId: string, fileId: string): Promise<boolean> {
    try {
      // Use the optimized ProjectFilesService for adding files to projects
      const { ProjectFilesService } = await import("./projectFilesService");
      return ProjectFilesService.addFileToProject(projectId, fileId);
    } catch (error) {
      console.error(
        `[ProjectService] Error adding file ${fileId} to project ${projectId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Check if a table exists
   * @param tableName Table name
   * @returns Promise<boolean> True if the table exists
   */
  private async checkIfTableExists(tableName: string): Promise<boolean> {
    try {
      const result = (await executeQuery(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = '${tableName}'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      return result && result.length > 0 && result[0].exists;
    } catch (error) {
      console.error(
        `[ProjectService] Error checking if table ${tableName} exists:`,
        error
      );
      return false;
    }
  }
}

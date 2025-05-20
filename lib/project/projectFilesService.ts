import { PrismaClient, Prisma } from "@prisma/client";
import { getConnectionManager } from "../database/connectionManager";

/**
 * Service for managing project files with optimized database access
 */
export class ProjectFilesService {
  /**
   * Get all files for a project using optimized Prisma queries
   * @param projectId Project ID
   * @returns Promise<any[]> Files
   */
  static async getProjectFiles(projectId: string): Promise<any[]> {
    try {
      console.log(
        `[ProjectFilesService] Getting files for project ${projectId}`
      );

      // Get connection manager
      const connectionManager = getConnectionManager();

      // Get a replica client from the pool
      const replicaClient = connectionManager.getReplicaClient();

      try {
        // First check if the project exists
        const project = await replicaClient.project.findUnique({
          where: { id: projectId },
          select: { id: true, name: true },
        });

        if (!project) {
          console.log(`[ProjectFilesService] Project ${projectId} not found`);
          return [];
        }

        console.log(`[ProjectFilesService] Project found: ${project.name}`);

        // Get all files for the project using Prisma's type-safe queries
        const files = await replicaClient.file.findMany({
          where: {
            // Files directly associated with the project
            projectId,
          },
          include: {
            // Include file errors count
            fileErrors: {
              select: { id: true },
            },
          },
          orderBy: {
            uploadedAt: "desc",
          },
        });

        console.log(
          `[ProjectFilesService] Found ${files.length} files for project ${projectId}`
        );

        // Format the response
        return files.map((file) => ({
          id: file.id,
          filename: file.filename,
          uploadedAt: file.uploadedAt,
          ingestedAt: file.ingestedAt,
          sizeBytes: file.sizeBytes,
          format: file.format,
          status: file.status,
          metadata: file.metadata,
          projectId: file.projectId,
          _count: {
            fileErrors: file.fileErrors.length,
          },
        }));
      } finally {
        // Release the client back to the pool
        connectionManager.releaseReplicaClient(replicaClient);
      }
    } catch (error) {
      console.error(
        `[ProjectFilesService] Error getting files for project ${projectId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Add a file to a project
   * @param projectId Project ID
   * @param fileId File ID
   * @returns Promise<boolean> Success
   */
  static async addFileToProject(
    projectId: string,
    fileId: string
  ): Promise<boolean> {
    try {
      // Get connection manager
      const connectionManager = getConnectionManager();

      // Get a replica client from the pool
      const replicaClient = connectionManager.getReplicaClient();

      try {
        // Check if the project exists
        const project = await replicaClient.project.findUnique({
          where: { id: projectId },
        });

        if (!project) {
          console.error(`[ProjectFilesService] Project ${projectId} not found`);
          return false;
        }

        // Check if the file exists
        const file = await replicaClient.file.findUnique({
          where: { id: fileId },
        });

        if (!file) {
          console.error(`[ProjectFilesService] File ${fileId} not found`);
          return false;
        }

        // Update the file to associate it with the project
        await replicaClient.file.update({
          where: { id: fileId },
          data: { projectId },
        });

        console.log(
          `[ProjectFilesService] Added file ${fileId} to project ${projectId}`
        );
        return true;
      } finally {
        // Release the client back to the pool
        connectionManager.releaseReplicaClient(replicaClient);
      }
    } catch (error) {
      console.error(
        `[ProjectFilesService] Error adding file ${fileId} to project ${projectId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Remove a file from a project
   * @param projectId Project ID
   * @param fileId File ID
   * @returns Promise<boolean> Success
   */
  static async removeFileFromProject(
    projectId: string,
    fileId: string
  ): Promise<boolean> {
    try {
      // Get connection manager
      const connectionManager = getConnectionManager();

      // Get a replica client from the pool
      const replicaClient = connectionManager.getReplicaClient();

      try {
        // Remove the file from the project by setting projectId to null
        await replicaClient.file.update({
          where: {
            id: fileId,
            projectId,
          },
          data: {
            projectId: null,
          },
        });

        console.log(
          `[ProjectFilesService] Removed file ${fileId} from project ${projectId}`
        );
        return true;
      } catch (error) {
        // Check if this is a Prisma error for record not found
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          console.log(
            `[ProjectFilesService] File ${fileId} was not associated with project ${projectId}`
          );
          return true;
        }
        throw error;
      } finally {
        // Release the client back to the pool
        connectionManager.releaseReplicaClient(replicaClient);
      }
    } catch (error) {
      console.error(
        `[ProjectFilesService] Error removing file ${fileId} from project ${projectId}:`,
        error
      );
      return false;
    }
  }
}

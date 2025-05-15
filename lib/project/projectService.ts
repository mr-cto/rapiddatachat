import { executeQuery } from "../database";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";

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
      console.log(
        `[ProjectService] Creating project "${name}" for user: ${userId}`
      );

      // Check if the projects table exists
      const tableExists = await this.checkIfTableExists("projects");

      if (!tableExists) {
        // Create the table if it doesn't exist
        await executeQuery(`
          CREATE TABLE projects (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }

      // Create the project
      const projectId = uuidv4();
      const project: Project = {
        id: projectId,
        userId,
        name,
        description,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Insert the project into the database
      await executeQuery(`
        INSERT INTO projects (id, user_id, name, description, created_at, updated_at)
        VALUES (
          '${project.id}',
          '${project.userId}',
          '${project.name}',
          ${project.description ? `'${project.description}'` : "NULL"},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `);

      return project;
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
      // Check if the projects table exists
      const tableExists = await this.checkIfTableExists("projects");

      if (!tableExists) {
        return [];
      }

      // Get all projects for the user
      const result = (await executeQuery(`
        SELECT id, user_id, name, description, created_at, updated_at
        FROM projects
        WHERE user_id = '${userId}'
        ORDER BY updated_at DESC
      `)) as Array<{
        id: string;
        user_id: string;
        name: string;
        description: string;
        created_at: string;
        updated_at: string;
      }>;

      // Convert the result to Project objects
      return (result || []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }));
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
      // Check if the projects table exists
      const tableExists = await this.checkIfTableExists("projects");

      if (!tableExists) {
        return null;
      }

      // Get the project
      const result = (await executeQuery(`
        SELECT id, user_id, name, description, created_at, updated_at
        FROM projects
        WHERE id = '${projectId}'
      `)) as Array<{
        id: string;
        user_id: string;
        name: string;
        description: string;
        created_at: string;
        updated_at: string;
      }>;

      if (!result || result.length === 0) {
        return null;
      }

      const row = result[0];

      // Convert to a Project object
      return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
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
      // Check if the project exists
      const existingProject = await this.getProjectById(project.id);

      if (!existingProject) {
        return null;
      }

      // Update the project
      project.updatedAt = new Date();
      await executeQuery(`
        UPDATE projects
        SET
          name = '${project.name}',
          description = ${
            project.description ? `'${project.description}'` : "NULL"
          },
          updated_at = CURRENT_TIMESTAMP
        WHERE id = '${project.id}'
      `);

      return project;
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
      // Check if the projects table exists
      const tableExists = await this.checkIfTableExists("projects");

      if (!tableExists) {
        return false;
      }

      // Check if the project exists
      const existingProject = await this.getProjectById(projectId);
      if (!existingProject) {
        return false;
      }

      // Delete the project
      await executeQuery(`
        DELETE FROM projects
        WHERE id = '${projectId}'
      `);

      return true;
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
  async getProjectFiles(projectId: string): Promise<any[]> {
    try {
      console.log(`[ProjectService] Getting files for project ${projectId}`);

      // Check if the project_files table exists
      const tableExists = await this.checkIfTableExists("project_files");
      console.log(
        `[ProjectService] project_files table exists: ${tableExists}`
      );

      if (!tableExists) {
        // Create the table if it doesn't exist
        console.log(`[ProjectService] Creating project_files table`);
        await executeQuery(`
          CREATE TABLE project_files (
            project_id TEXT NOT NULL,
            file_id TEXT NOT NULL,
            PRIMARY KEY (project_id, file_id)
          )
        `);
      }

      // First check if the project exists
      const project = await this.getProjectById(projectId);
      if (!project) {
        console.log(`[ProjectService] Project ${projectId} not found`);
        return [];
      }
      console.log(`[ProjectService] Project found: ${project.name}`);

      // Check if there are any files with this projectId directly
      const filesWithProjectId = await executeQuery(`
        SELECT COUNT(*) as count FROM files WHERE project_id = '${projectId}'
      `);
      console.log(
        `[ProjectService] Files with projectId directly:`,
        filesWithProjectId
      );

      // Check if there are any files in the join table
      const filesInJoinTable = await executeQuery(`
        SELECT COUNT(*) as count FROM project_files WHERE project_id = '${projectId}'
      `);
      console.log(`[ProjectService] Files in join table:`, filesInJoinTable);

      // Get all files for the project
      const query = `
        SELECT
          f.id,
          f.filename,
          f.uploaded_at as "uploadedAt",
          f.ingested_at as "ingestedAt",
          f.size_bytes as "sizeBytes",
          f.format,
          f.status,
          f.metadata,
          f.project_id as "projectId",
          (SELECT COUNT(*) FROM file_errors fe WHERE fe.file_id = f.id) as "fileErrors"
        FROM
          files f
        WHERE
          f.user_id = (SELECT user_id FROM projects WHERE id = '${projectId}') AND
          (
            f.id IN (
              SELECT file_id FROM project_files WHERE project_id = '${projectId}'
            )
            OR
            f.project_id = '${projectId}'
          )
        ORDER BY
          f.uploaded_at DESC
      `;

      console.log(`[ProjectService] Executing query: ${query}`);
      const result = await executeQuery(query);
      console.log(`[ProjectService] Query result:`, result);

      // Ensure result is an array
      // If result is a number, it's likely the count of rows affected, not the actual rows
      let files = [];
      if (Array.isArray(result)) {
        files = result;
      } else if (typeof result === "number") {
        // If result is a number, we need to execute the query again to get the actual rows
        console.log(
          `[ProjectService] Result is a number (${result}), fetching actual rows...`
        );
        // Execute the query again with $queryRawUnsafe to ensure we get the rows
        const prisma = new PrismaClient();
        const rawResult = await prisma.$queryRawUnsafe(query);
        files = Array.isArray(rawResult) ? rawResult : [];
        console.log(`[ProjectService] Re-fetched files:`, files);
      }

      console.log(
        `[ProjectService] Found ${files.length} files for project ${projectId}`
      );

      // Format the response
      return files.map((file: any) => ({
        ...file,
        _count: {
          fileErrors: parseInt(String(file.fileErrors) || "0"),
        },
      }));
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
      // Check if the project_files table exists
      const tableExists = await this.checkIfTableExists("project_files");

      if (!tableExists) {
        // Create the table if it doesn't exist
        await executeQuery(`
          CREATE TABLE project_files (
            project_id TEXT NOT NULL,
            file_id TEXT NOT NULL,
            PRIMARY KEY (project_id, file_id)
          )
        `);
      }

      // Add the file to the project
      await executeQuery(`
        INSERT INTO project_files (project_id, file_id)
        VALUES ('${projectId}', '${fileId}')
        ON CONFLICT (project_id, file_id) DO NOTHING
      `);

      return true;
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

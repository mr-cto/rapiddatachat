/**
 * Compatibility layer for file activation
 *
 * This file provides compatibility functions for the legacy file activation system.
 * It ensures that existing code that depends on file activation functions continues to work
 * while the actual activation logic has been removed as part of the simplified upload flow.
 */

import { executeQuery } from "./database";

// Define file status enum for compatibility
export enum FileStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  ACTIVE = "active",
  ERROR = "error",
}

/**
 * Check if a file exists (compatibility function)
 * @param fileId File ID
 * @returns Promise<boolean> True if file exists, false otherwise
 */
export async function fileExists(fileId: string): Promise<boolean> {
  try {
    const result = (await executeQuery(`
      SELECT COUNT(*) as count FROM files
      WHERE id = '${fileId}'
    `)) as { count: number }[];

    return result && result.length > 0 && result[0].count > 0;
  } catch (error) {
    console.warn(`[Compat] Error checking if file exists: ${error}`);
    return false;
  }
}

/**
 * Update file status in the database (compatibility function)
 * In the simplified flow, files are automatically set to active after upload
 * @param fileId File ID
 * @param status New status (ignored, always sets to ACTIVE)
 * @returns Promise<boolean> True if successful, false otherwise
 */
export async function updateFileStatus(
  fileId: string,
  status: FileStatus
): Promise<boolean> {
  try {
    // In the simplified flow, we always set the status to ACTIVE
    await executeQuery(`
      UPDATE files
      SET status = '${FileStatus.ACTIVE}'
      WHERE id = '${fileId}'
    `);

    console.log(
      `[Compat] Updated file ${fileId} status to ${FileStatus.ACTIVE} (ignoring requested status ${status})`
    );
    return true;
  } catch (error) {
    console.warn(`[Compat] Error updating file status: ${error}`);
    return false;
  }
}

/**
 * Check if a file belongs to a user (compatibility function)
 * @param fileId File ID
 * @param userId User ID
 * @returns Promise<boolean> True if file belongs to user, false otherwise
 */
export async function fileExistsForUser(
  fileId: string,
  userId: string
): Promise<boolean> {
  // In development mode, allow access to all files
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  try {
    const result = (await executeQuery(`
      SELECT COUNT(*) as count FROM files
      WHERE id = '${fileId}' AND user_id = '${userId}'
    `)) as { count: number }[];

    return result && result.length > 0 && result[0].count > 0;
  } catch (error) {
    console.warn(`[Compat] Error checking if file exists for user: ${error}`);
    return false;
  }
}

/**
 * Activate a file for a user (compatibility function)
 * In the simplified flow, files are automatically activated after upload
 * @param fileId File ID
 * @param userId User ID
 * @returns Promise<{success: boolean, message: string}> Result of activation
 */
export async function activateFile(
  fileId: string,
  userId: string
): Promise<{
  success: boolean;
  message: string;
  progress?: number;
}> {
  try {
    // Check if file exists
    if (!(await fileExists(fileId))) {
      return { success: false, message: "File not found", progress: 0 };
    }

    // Check if file belongs to user
    if (!(await fileExistsForUser(fileId, userId))) {
      return { success: false, message: "Access denied", progress: 0 };
    }

    // Update file status to active
    await updateFileStatus(fileId, FileStatus.ACTIVE);

    // Attach file to user workspace (create view)
    const attached = await attachFileToUserWorkspace(fileId, userId);
    if (!attached) {
      console.warn(
        `[Compat] Failed to attach file ${fileId} to user workspace, but continuing activation`
      );
      // Continue with activation even if view creation fails
    }

    return {
      success: true,
      message: attached
        ? "File activated successfully with view creation (compatibility mode)"
        : "File activated successfully but view creation failed (compatibility mode)",
      progress: 100,
    };
  } catch (error) {
    console.error(`[Compat] Error activating file: ${error}`);
    return {
      success: false,
      message: `Failed to activate file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      progress: 0,
    };
  }
}

/**
 * Get activation progress for a file (compatibility function)
 * In the simplified flow, files are always 100% activated
 * @param fileId File ID
 * @returns Promise<{progress: number, startedAt: Date | null, completedAt: Date | null, error: string | null} | null> Activation progress or null if not found
 */
export async function getActivationProgress(fileId: string): Promise<{
  progress: number;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
} | null> {
  try {
    // Check if file exists
    if (!(await fileExists(fileId))) {
      return null;
    }

    // In the simplified flow, files are always 100% activated
    return {
      progress: 100,
      startedAt: null,
      completedAt: new Date(),
      error: null,
    };
  } catch (error) {
    console.warn(`[Compat] Error getting activation progress: ${error}`);
    return null;
  }
}

/**
 * Activates all available files for a user (compatibility function)
 * In the simplified flow, files are automatically activated after upload
 * @param userId User ID
 * @returns Promise<{success: boolean, activatedCount: number, message: string}> Result of activation
 */
export async function activateAvailableFiles(userId: string): Promise<{
  success: boolean;
  activatedCount: number;
  message: string;
}> {
  try {
    // Get all files for the user that are not already active
    const files = (await executeQuery(`
      SELECT id, filename FROM files
      WHERE user_id = '${userId}'
      AND status != '${FileStatus.ACTIVE}'
    `)) as Array<{ id: string; filename: string }>;

    if (!files || files.length === 0) {
      // Check for files that are already marked as active but don't have a view
      console.log(
        `[Compat] No non-active files found, checking for active files with missing views`
      );

      const activeFiles = (await executeQuery(`
        SELECT id, filename FROM files
        WHERE user_id = '${userId}'
        AND status = '${FileStatus.ACTIVE}'
      `)) as Array<{ id: string; filename: string }>;

      if (activeFiles && activeFiles.length > 0) {
        console.log(
          `[Compat] Found ${activeFiles.length} active files, ensuring they have views`
        );

        // Try to create views for all active files
        let viewsCreated = 0;
        for (const file of activeFiles) {
          const attached = await attachFileToUserWorkspace(file.id, userId);
          if (attached) {
            viewsCreated++;
          }
        }

        if (viewsCreated > 0) {
          return {
            success: true,
            activatedCount: viewsCreated,
            message: `Created views for ${viewsCreated} of ${activeFiles.length} already active files (compatibility mode)`,
          };
        }
      }

      return {
        success: true,
        activatedCount: 0,
        message: "No files to activate",
      };
    }

    // Update all files to active status
    await executeQuery(`
      UPDATE files
      SET status = '${FileStatus.ACTIVE}'
      WHERE user_id = '${userId}'
      AND status != '${FileStatus.ACTIVE}'
    `);

    // Create views for all activated files
    let viewsCreated = 0;
    for (const file of files) {
      const attached = await attachFileToUserWorkspace(file.id, userId);
      if (attached) {
        viewsCreated++;
      }
    }

    return {
      success: true,
      activatedCount: files.length,
      message: `Activated ${files.length} files and created ${viewsCreated} views (compatibility mode)`,
    };
  } catch (error) {
    console.error(`[Compat] Error activating available files: ${error}`);
    return {
      success: false,
      activatedCount: 0,
      message: `Failed to activate files: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

/**
 * Attach a file table to a user's query workspace (compatibility function)
 * @param fileId File ID
 * @param userId User ID
 * @returns Promise<boolean> True if successful, false otherwise
 */
export async function attachFileToUserWorkspace(
  fileId: string,
  userId: string
): Promise<boolean> {
  try {
    // Get the file information to use the filename in the view
    const fileInfo = (await executeQuery(`
      SELECT filename FROM files WHERE id = '${fileId}'
    `)) as Array<{ filename: string }>;

    if (!fileInfo || fileInfo.length === 0) {
      console.warn(`[Compat] File ${fileId} not found for view creation`);
      return false;
    }

    // Create a sanitized filename for the view
    const filename = fileInfo[0].filename;
    const sanitizedFilename = filename
      .replace(/\.[^/.]+$/, "") // Remove file extension
      .replace(/\s+/g, "_") // Replace spaces with underscores
      .replace(/[^a-zA-Z0-9_]/g, ""); // Remove special characters

    // Create a sanitized user ID for the view name
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9]/g, "_");

    // Create a view name that includes both the user ID and the filename
    const viewName = `data_${sanitizedUserId}_${sanitizedFilename}`;

    console.log(
      `[Compat] Creating view ${viewName} for file ${fileId} (${filename})`
    );

    try {
      // Check if the file_data table exists
      const tableExists = await executeQuery(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'file_data'
        ) as exists
      `);

      const fileDataTableExists =
        Array.isArray(tableExists) &&
        tableExists.length > 0 &&
        tableExists[0].exists === true;

      if (!fileDataTableExists) {
        console.log(`[Compat] file_data table does not exist, creating it`);
        // Create the file_data table
        await executeQuery(`
          CREATE TABLE IF NOT EXISTS "file_data" (
            "id" TEXT NOT NULL,
            "file_id" TEXT NOT NULL,
            "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "data" JSONB NOT NULL,
            CONSTRAINT "file_data_pkey" PRIMARY KEY ("id")
          );
          
          CREATE INDEX IF NOT EXISTS "idx_file_data_file" ON "file_data"("file_id");
        `);
        console.log(`[Compat] Created file_data table`);
      }

      // Create the view
      await executeQuery(`
        CREATE OR REPLACE VIEW "${viewName}" AS
        SELECT data FROM "file_data" WHERE file_id = '${fileId}'
      `);

      console.log(
        `[Compat] Successfully created view ${viewName} for file ${fileId}`
      );

      // Also update the view_metadata table if it exists
      try {
        const viewMetadataExists = await executeQuery(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'view_metadata'
          ) as exists
        `);

        const viewMetadataTableExists =
          Array.isArray(viewMetadataExists) &&
          viewMetadataExists.length > 0 &&
          viewMetadataExists[0].exists === true;

        if (viewMetadataTableExists) {
          await executeQuery(`
            INSERT INTO view_metadata (view_name, file_id, user_id, original_filename)
            VALUES ('${viewName}', '${fileId}', '${userId}', '${filename}')
            ON CONFLICT (view_name)
            DO UPDATE SET
              file_id = EXCLUDED.file_id,
              user_id = EXCLUDED.user_id,
              original_filename = EXCLUDED.original_filename,
              created_at = CURRENT_TIMESTAMP
          `);
          console.log(`[Compat] Updated view_metadata for ${viewName}`);
        }
      } catch (metadataError) {
        console.warn(`[Compat] Error updating view_metadata: ${metadataError}`);
        // Continue even if metadata update fails
      }

      return true;
    } catch (viewError) {
      console.error(`[Compat] Error creating view: ${viewError}`);
      return false;
    }
  } catch (error) {
    console.warn(`[Compat] Error attaching file to user workspace: ${error}`);
    return false;
  }
}

// Export all functions from this file as the default export
export default {
  FileStatus,
  fileExists,
  updateFileStatus,
  fileExistsForUser,
  activateFile,
  getActivationProgress,
  activateAvailableFiles,
  attachFileToUserWorkspace,
};

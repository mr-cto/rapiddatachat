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

    return {
      success: true,
      message: "File activated successfully (compatibility mode)",
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
      SELECT id FROM files
      WHERE user_id = '${userId}'
      AND status != '${FileStatus.ACTIVE}'
    `)) as Array<{ id: string }>;

    if (!files || files.length === 0) {
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

    return {
      success: true,
      activatedCount: files.length,
      message: `Activated ${files.length} files (compatibility mode)`,
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

// Export all functions from this file as the default export
export default {
  FileStatus,
  fileExists,
  updateFileStatus,
  fileExistsForUser,
  activateFile,
  getActivationProgress,
  activateAvailableFiles,
};

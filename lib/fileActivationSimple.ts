/**
 * Simple file activation module
 *
 * This module provides a simplified file activation process where files are
 * automatically set to active after upload.
 */

import { executeQuery } from "./database";

/**
 * File status enum
 */
export enum FileStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  ACTIVE = "active",
  ERROR = "error",
}

/**
 * Automatically activate a file after upload
 * @param {string} fileId - The ID of the file to activate
 * @returns {Promise<boolean>} - True if activation was successful, false otherwise
 */
export async function autoActivateFile(fileId: string): Promise<boolean> {
  try {
    console.log(`[SimpleActivation] Auto-activating file ${fileId}`);

    // Update file status to active
    await executeQuery(`
      UPDATE files
      SET status = '${FileStatus.ACTIVE}'
      WHERE id = '${fileId}'
    `);

    console.log(`[SimpleActivation] File ${fileId} activated successfully`);
    return true;
  } catch (error) {
    console.error(`[SimpleActivation] Error activating file ${fileId}:`, error);
    return false;
  }
}

/**
 * Hook to be called after file upload
 * @param {string} fileId - The ID of the uploaded file
 * @param {string} userId - The ID of the user who uploaded the file
 * @returns {Promise<void>}
 */
export async function postUploadHook(
  fileId: string,
  userId: string
): Promise<void> {
  try {
    console.log(
      `[SimpleActivation] Processing uploaded file ${fileId} for user ${userId}`
    );

    // Auto-activate the file
    await autoActivateFile(fileId);

    // Additional post-upload processing can be added here
  } catch (error) {
    console.error(`[SimpleActivation] Error in post-upload hook:`, error);
  }
}

export default {
  FileStatus,
  autoActivateFile,
  postUploadHook,
};

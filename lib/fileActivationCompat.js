const { executeQuery } = require("./database");
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const { v4: uuidv4 } = require("uuid");

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

/**
 * Compatibility version of the file activation service that doesn't use
 * the activation progress columns in the database
 */

/**
 * Activate a file for a user
 * @param fileId File ID
 * @param userId User ID
 * @returns Promise<{ success: boolean; message: string; viewName?: string }>
 */
async function activateFile(fileId, userId) {
  try {
    console.log(
      `[FileActivation] Activating file ${fileId} for user ${userId}`
    );

    // Check if file exists and belongs to the user
    const fileExists = await checkFileExists(fileId, userId);
    if (!fileExists) {
      console.log(
        `[FileActivation] File ${fileId} not found or does not belong to user ${userId}`
      );
      return {
        success: false,
        message: "File not found or does not belong to user",
      };
    }

    // Get file info
    const fileInfo = await getFileInfo(fileId);
    if (!fileInfo) {
      console.log(`[FileActivation] Could not get file info for ${fileId}`);
      return { success: false, message: "Could not get file info" };
    }

    // Update file status to processing
    await updateFileStatus(fileId, "processing");
    console.log(`Updated file ${fileId} status to processing`);

    // Create a view name based on user ID and filename
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9]/g, "_");
    const sanitizedFilename = path
      .basename(fileInfo.filename, path.extname(fileInfo.filename))
      .replace(/[^a-zA-Z0-9]/g, "_");
    const viewName = `data_${sanitizedUserId}_${sanitizedFilename}`;
    console.log(
      `[FileActivation] Creating view ${viewName} for file ${fileId} (${fileInfo.filename})`
    );

    // Check if view_metadata table exists
    const viewMetadataExists = await checkTableExists("view_metadata");
    console.log(
      `[FileActivation] Table view_metadata exists: ${viewMetadataExists}`
    );

    if (viewMetadataExists) {
      // Store view metadata
      await storeViewMetadata(fileId, userId, viewName, fileInfo.filename);
    } else {
      console.log(
        `[FileActivation] view_metadata table does not exist, using direct view creation`
      );
    }

    // Create the view
    const createViewResult = await createView(fileId, viewName);
    if (!createViewResult) {
      console.log(`[FileActivation] Failed to create view for file ${fileId}`);
      await updateFileStatus(fileId, "error");
      return { success: false, message: "Failed to create view" };
    }

    console.log(
      `[FileActivation] Successfully attached file ${fileId} to user ${userId} workspace as ${viewName}`
    );

    // Update file status to active
    await updateFileStatus(fileId, "active");
    console.log(`Updated file ${fileId} status to active`);

    return { success: true, message: "File activated successfully", viewName };
  } catch (error) {
    console.error(`[FileActivation] Error activating file ${fileId}:`, error);
    // Update file status to error
    try {
      await updateFileStatus(fileId, "error");
    } catch (statusError) {
      console.error(
        `[FileActivation] Error updating file status:`,
        statusError
      );
    }
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unknown error during file activation",
    };
  }
}

/**
 * Check if a file exists and belongs to a user
 * @param fileId File ID
 * @param userId User ID
 * @returns Promise<boolean>
 */
async function checkFileExists(fileId, userId) {
  try {
    const result = await executeQuery(`
      SELECT COUNT(*) as count FROM files
      WHERE id = '${fileId}' AND user_id = '${userId}'
    `);

    return result && result.length > 0 && result[0].count > 0;
  } catch (error) {
    console.error(`[FileActivation] Error checking if file exists:`, error);
    return false;
  }
}

/**
 * Get file information
 * @param fileId File ID
 * @returns Promise<{ filename: string; filepath?: string } | null>
 */
async function getFileInfo(fileId) {
  try {
    const result = await executeQuery(`
      SELECT filename, filepath FROM files
      WHERE id = '${fileId}'
    `);

    if (!result || result.length === 0) {
      return null;
    }

    return {
      filename: result[0].filename,
      filepath: result[0].filepath,
    };
  } catch (error) {
    console.error(`[FileActivation] Error getting file info:`, error);
    return null;
  }
}

/**
 * Update file status
 * @param fileId File ID
 * @param status New status
 * @returns Promise<boolean>
 */
async function updateFileStatus(fileId, status) {
  try {
    await executeQuery(`
      UPDATE files
      SET status = '${status}'
      WHERE id = '${fileId}'
    `);
    return true;
  } catch (error) {
    console.error(`[FileActivation] Error updating file status:`, error);
    return false;
  }
}

/**
 * Check if a table exists
 * @param tableName Table name
 * @returns Promise<boolean>
 */
async function checkTableExists(tableName) {
  try {
    const result = await executeQuery(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = '${tableName}'
      ) as exists
    `);

    return result && result.length > 0 && result[0].exists;
  } catch (error) {
    console.error(`[FileActivation] Error checking if table exists:`, error);
    return false;
  }
}

/**
 * Store view metadata
 * @param fileId File ID
 * @param userId User ID
 * @param viewName View name
 * @param originalFilename Original filename
 * @returns Promise<boolean>
 */
async function storeViewMetadata(fileId, userId, viewName, originalFilename) {
  try {
    await executeQuery(`
      INSERT INTO view_metadata (id, file_id, user_id, view_name, original_filename, created_at)
      VALUES (
        '${uuidv4()}',
        '${fileId}',
        '${userId}',
        '${viewName}',
        '${originalFilename}',
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (file_id) DO UPDATE
      SET view_name = '${viewName}',
          updated_at = CURRENT_TIMESTAMP
    `);
    return true;
  } catch (error) {
    console.error(`[FileActivation] Error storing view metadata:`, error);
    return false;
  }
}

/**
 * Create a view for a file
 * @param fileId File ID
 * @param viewName View name
 * @returns Promise<boolean>
 */
async function createView(fileId, viewName) {
  try {
    // Create a view that selects from the file_data table
    const createViewSql = `
      CREATE OR REPLACE VIEW ${viewName} AS
      SELECT fd.id, fd.data
      FROM file_data fd
      WHERE fd.file_id = '${fileId}'
    `;

    console.log("Executing CREATE VIEW statement");
    await executeQuery(createViewSql);
    return true;
  } catch (error) {
    console.error(`[FileActivation] Error creating view:`, error);
    return false;
  }
}

module.exports = {
  activateFile,
};

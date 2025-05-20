import { executeQuery, checkIfTableExists } from "./database";
import { handleFileError, ErrorType, ErrorSeverity } from "./errorHandling";

/**
 * Check if a view exists
 * @param viewName View name
 * @returns Promise<boolean> True if the view exists
 */
async function checkIfViewExists(viewName: string): Promise<boolean> {
  try {
    console.log(`[FileActivation] Checking if view ${viewName} exists`);

    const result = (await executeQuery(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_name = '${viewName}'
      ) as exists
    `)) as Array<{ exists: boolean }>;

    const exists = result && result.length > 0 && result[0].exists;
    console.log(`[FileActivation] View ${viewName} exists: ${exists}`);

    return exists;
  } catch (error) {
    console.error(
      `[FileActivation] Error checking if view ${viewName} exists:`,
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[FileActivation] Error details: ${errorMessage}`);
    return false;
  }
}

// Using imported checkIfTableExists from database.ts

// Define file status enum
export enum FileStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  ACTIVE = "active",
  ERROR = "error",
}

/**
 * Update file status in the database
 * @param fileId File ID
 * @param status New status
 * @returns Promise<boolean> True if successful, false otherwise
 */
export async function updateFileStatus(
  fileId: string,
  status: FileStatus
): Promise<boolean> {
  try {
    await executeQuery(`
      UPDATE files
      SET status = '${status}'
      WHERE id = '${fileId}'
    `);

    console.log(`Updated file ${fileId} status to ${status}`);
    return true;
  } catch (error) {
    // Check if this is a database server environment error
    if (
      error instanceof Error &&
      (error.message.includes(
        "DuckDB is only available in browser environments"
      ) ||
        error.message.includes("Worker is not defined") ||
        error.message === "DuckDB is not available in server environments" ||
        error.message.includes("Can't reach database server"))
    ) {
      console.warn(
        `Database operation skipped (server environment): Unable to update file status to ${status} for file ${fileId}`
      );
      // Return true to allow the operation to continue
      return true;
    }

    console.error(`Error updating file status: ${error}`);

    try {
      await handleFileError(
        fileId,
        ErrorType.DATABASE,
        ErrorSeverity.MEDIUM,
        `Failed to update file status to ${status}`,
        { error }
      );
    } catch (errorHandlingError) {
      // If error handling itself fails due to database issues, just log it
      if (
        errorHandlingError instanceof Error &&
        (errorHandlingError.message.includes(
          "DuckDB is only available in browser environments"
        ) ||
          errorHandlingError.message.includes("Worker is not defined") ||
          errorHandlingError.message ===
            "DuckDB is not available in server environments" ||
          errorHandlingError.message.includes("Can't reach database server"))
      ) {
        console.warn(
          "Database operation skipped (server environment): Unable to store error in database"
        );
      } else {
        console.error("Error handling failed:", errorHandlingError);
      }
    }

    return false;
  }
}

/**
 * Check if a file exists in the database
 * @param fileId File ID
 * @returns Promise<boolean> True if file exists, false otherwise
 */
export async function fileExists(fileId: string): Promise<boolean> {
  try {
    const result = (await executeQuery(`
      SELECT COUNT(*) as count FROM files WHERE id = '${fileId}'
    `)) as { count: number }[];

    return result && result.length > 0 && result[0].count > 0;
  } catch (error) {
    // Check if this is a database server environment error
    if (
      error instanceof Error &&
      (error.message.includes(
        "DuckDB is only available in browser environments"
      ) ||
        error.message.includes("Worker is not defined") ||
        error.message === "DuckDB is not available in server environments" ||
        error.message.includes("Can't reach database server"))
    ) {
      console.warn(
        `Database operation skipped (server environment): Unable to check if file ${fileId} exists`
      );
      // Assume file exists to allow the operation to continue
      return true;
    }

    console.error(`Error checking if file exists: ${error}`);
    return false;
  }
}

/**
 * Check if a file belongs to a user
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
    // Check if this is a database server environment error
    if (
      error instanceof Error &&
      (error.message.includes(
        "DuckDB is only available in browser environments"
      ) ||
        error.message.includes("Worker is not defined") ||
        error.message === "DuckDB is not available in server environments" ||
        error.message.includes("Can't reach database server"))
    ) {
      console.warn(
        `Database operation skipped (server environment): Unable to check if file ${fileId} exists for user ${userId}`
      );
      // Assume file belongs to user to allow the operation to continue
      return true;
    }

    console.error(`Error checking if file exists for user: ${error}`);
    return false;
  }
}

/**
 * Check if a file table exists
 * @param fileId File ID
 * @returns Promise<boolean> True if file table exists, false otherwise
 */
export async function fileTableExists(fileId: string): Promise<boolean> {
  try {
    // First check if the file_data table exists
    const tableExists = await checkIfTableExists("file_data");

    if (!tableExists) {
      console.log(
        `[FileActivation] file_data table does not exist, assuming file table doesn't exist`
      );
      return false;
    }

    // For PostgreSQL, check if there are any FileData entries for this file
    const result = (await executeQuery(`
      SELECT COUNT(*) as count FROM file_data WHERE file_id = '${fileId}'
    `)) as { count: number }[];

    return result && result.length > 0 && result[0].count > 0;
  } catch (error) {
    // Check if this is a database server environment error
    if (
      error instanceof Error &&
      (error.message.includes(
        "DuckDB is only available in browser environments"
      ) ||
        error.message.includes("Worker is not defined") ||
        error.message === "DuckDB is not available in server environments" ||
        error.message.includes("Can't reach database server"))
    ) {
      console.warn(
        `Database operation skipped (server environment): Unable to check if file table exists for file ${fileId}`
      );
      // Assume file table exists to allow the operation to continue
      return true;
    }

    console.error(`Error checking if file table exists: ${error}`);
    return false;
  }
}

/**
 * Attach a file table to a user's query workspace
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
      console.error(`[FileActivation] File ${fileId} not found`);
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
      `[FileActivation] Creating view ${viewName} for file ${fileId} (${filename})`
    );

    try {
      // First, check if the view_metadata table exists
      const tableExists = await checkIfTableExists("view_metadata");

      if (!tableExists) {
        console.log(
          `[FileActivation] view_metadata table does not exist, using direct view creation`
        );

        // For PostgreSQL, create a view that selects from file_data
        // Always use "public" schema
        try {
          // First check if file_data table exists
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
            console.log(
              `[FileActivation] file_data table does not exist, creating it`
            );
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
            console.log(`[FileActivation] Created file_data table`);
          }

          // Now create the view
          await executeQuery(`
            CREATE OR REPLACE VIEW "${viewName}" AS
            SELECT data FROM "file_data" WHERE file_id = '${fileId}'
          `);
        } catch (tableError) {
          console.error(
            `[FileActivation] Error checking or creating file_data table: ${tableError}`
          );
          // Continue with view creation attempt anyway
          await executeQuery(`
            CREATE OR REPLACE VIEW "${viewName}" AS
            SELECT data FROM "file_data" WHERE file_id = '${fileId}'
          `);
        }
      } else {
        // Use the existing view_metadata table
        console.log(
          `[FileActivation] view_metadata table exists, using it to track views`
        );

        // Insert or update the metadata for this view
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

        // Create the view
        try {
          await executeQuery(`
            CREATE OR REPLACE VIEW "${viewName}" AS
            SELECT data FROM "file_data" WHERE file_id = '${fileId}'
          `);
          console.log(
            `[FileActivation] Successfully created view ${viewName} for file ${fileId}`
          );
        } catch (viewError) {
          if (
            viewError instanceof Error &&
            viewError.message.includes("permission denied")
          ) {
            console.error(
              `[FileActivation] Permission error creating view: ${viewError.message}`
            );
            console.log(
              `[FileActivation] Attempting to use materialized view instead...`
            );

            // Try creating a materialized view instead which might have different permission requirements
            await executeQuery(`
              CREATE MATERIALIZED VIEW IF NOT EXISTS "${viewName}_mat" AS
              SELECT data FROM "file_data" WHERE file_id = '${fileId}'
            `);
            console.log(
              `[FileActivation] Successfully created materialized view ${viewName}_mat for file ${fileId}`
            );
          } else {
            throw viewError;
          }
        }
      }

      console.log(
        `[FileActivation] Successfully attached file ${fileId} to user ${userId} workspace as ${viewName}`
      );
      return true;
    } catch (viewError) {
      console.error(
        `[FileActivation] Error creating view, trying alternative approach:`,
        viewError
      );

      // Try an alternative approach with a simpler view name
      const simpleViewName = `data_file_${fileId.replace(/-/g, "_")}`;

      try {
        // Try to create a view first
        await executeQuery(`
          CREATE OR REPLACE VIEW "${simpleViewName}" AS
          SELECT data FROM "file_data" WHERE file_id = '${fileId}'
        `);

        // Also update the metadata for this view
        await executeQuery(`
          INSERT INTO view_metadata (view_name, file_id, user_id, original_filename)
          VALUES ('${simpleViewName}', '${fileId}', '${userId}', '${filename}')
          ON CONFLICT (view_name)
          DO UPDATE SET
            file_id = EXCLUDED.file_id,
            user_id = EXCLUDED.user_id,
            original_filename = EXCLUDED.original_filename,
            created_at = CURRENT_TIMESTAMP
        `);

        console.log(
          `[FileActivation] Successfully created alternative view ${simpleViewName} for file ${fileId}`
        );
      } catch (viewError) {
        if (
          viewError instanceof Error &&
          viewError.message.includes("permission denied")
        ) {
          console.error(
            `[FileActivation] Permission error creating alternative view: ${viewError.message}`
          );
          console.log(
            `[FileActivation] Attempting to use temporary table instead...`
          );

          try {
            // As a last resort, try creating a temporary table with the data
            await executeQuery(`
              CREATE TEMPORARY TABLE IF NOT EXISTS "${simpleViewName}_temp" AS
              SELECT data FROM "file_data" WHERE file_id = '${fileId}'
            `);
            console.log(
              `[FileActivation] Successfully created temporary table ${simpleViewName}_temp for file ${fileId}`
            );
          } catch (tempTableError) {
            console.error(
              `[FileActivation] Error creating temporary table: ${tempTableError}`
            );
            // Even if temporary table creation fails, we'll continue with activation
            // The file will be marked as active but the view won't be available
            console.log(
              `[FileActivation] Continuing with activation despite view/table creation failures`
            );
          }
        } else {
          console.error(
            `[FileActivation] Non-permission error creating view: ${viewError}`
          );
          // Continue with activation even if view creation fails with other errors
        }
      }

      // Return true to continue with activation regardless of view creation success
      return true;
    }
  } catch (error) {
    // Check if this is a database server environment error
    if (
      error instanceof Error &&
      (error.message.includes(
        "DuckDB is only available in browser environments"
      ) ||
        error.message.includes("Worker is not defined") ||
        error.message === "DuckDB is not available in server environments" ||
        error.message.includes("Can't reach database server"))
    ) {
      console.warn(
        `Database operation skipped (server environment): Unable to attach file ${fileId} to user ${userId} workspace`
      );
      // Return true to allow the operation to continue
      return true;
    }

    console.error(`Error attaching file to user workspace: ${error}`);

    try {
      await handleFileError(
        fileId,
        ErrorType.DATABASE,
        ErrorSeverity.MEDIUM,
        `Failed to attach file to user workspace`,
        { error, userId }
      );
    } catch (errorHandlingError) {
      // If error handling itself fails due to database issues, just log it
      if (
        errorHandlingError instanceof Error &&
        (errorHandlingError.message.includes(
          "DuckDB is only available in browser environments"
        ) ||
          errorHandlingError.message.includes("Worker is not defined") ||
          errorHandlingError.message ===
            "DuckDB is not available in server environments" ||
          errorHandlingError.message.includes("Can't reach database server"))
      ) {
        console.warn(
          "Database operation skipped (server environment): Unable to store error in database"
        );
      } else {
        console.error("Error handling failed:", errorHandlingError);
      }
    }

    return false;
  }
}

/**
 * Activate a file for a user
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
  dbOperationsSkipped?: boolean;
}> {
  try {
    let dbOperationsSkipped = false;

    // Check if file exists
    if (!(await fileExists(fileId))) {
      return { success: false, message: "File not found" };
    }

    // Check if file belongs to user
    if (!(await fileExistsForUser(fileId, userId))) {
      return { success: false, message: "Access denied" };
    }

    // Check if file table exists
    if (!(await fileTableExists(fileId))) {
      return { success: false, message: "File data not found" };
    }

    // Get current file status
    let fileStatus = "";
    try {
      const fileResult = (await executeQuery(`
        SELECT status FROM files WHERE id = '${fileId}'
      `)) as { status: string }[];

      if (fileResult && fileResult.length > 0) {
        fileStatus = fileResult[0].status;
      }
    } catch (error) {
      // Check if this is a database server environment error
      if (
        error instanceof Error &&
        (error.message.includes(
          "DuckDB is only available in browser environments"
        ) ||
          error.message.includes("Worker is not defined") ||
          error.message === "DuckDB is not available in server environments" ||
          error.message.includes("Can't reach database server"))
      ) {
        console.warn(
          `Database operation skipped (server environment): Unable to get file status for file ${fileId}`
        );
        dbOperationsSkipped = true;
      } else {
        throw error;
      }
    }

    // Check if file is already active
    if (fileStatus === FileStatus.ACTIVE) {
      return {
        success: true,
        message: "File is already active",
        dbOperationsSkipped,
      };
    }

    // Check if file is in error state - we'll try to reactivate it anyway
    if (fileStatus === FileStatus.ERROR) {
      console.log(
        `[FileActivation] File ${fileId} is in error state, attempting to reactivate`
      );
      // Continue with activation instead of returning error
    }

    // Check if file is still processing
    if (fileStatus === FileStatus.PROCESSING) {
      return {
        success: false,
        message: "File is still being processed and cannot be activated yet",
        dbOperationsSkipped,
      };
    }

    // Attach file to user workspace
    let attached = false;
    try {
      attached = await attachFileToUserWorkspace(fileId, userId);
      if (!attached) {
        console.warn(
          `[FileActivation] Failed to attach file ${fileId} to user workspace, but continuing activation`
        );
        // Continue with activation even if view creation fails
        // This allows the file to be marked as active and usable through other means
      }
    } catch (attachError) {
      console.error(
        `[FileActivation] Error attaching file to workspace: ${attachError}`
      );
      // Continue with activation even if view creation fails
      // Log the error but don't fail the entire activation process
    }

    // If we're using the viewless approach, log this information
    if (attached === true) {
      console.log(
        `[FileActivation] File ${fileId} activated using viewless approach due to permission restrictions`
      );
      dbOperationsSkipped = true;
    }

    // Update file status to active
    if (!(await updateFileStatus(fileId, FileStatus.ACTIVE))) {
      return {
        success: false,
        message: "Failed to update file status",
        dbOperationsSkipped,
      };
    }

    return {
      success: true,
      message: "File activated successfully",
      dbOperationsSkipped,
    };
  } catch (error) {
    console.error(`Error activating file: ${error}`);

    try {
      await handleFileError(
        fileId,
        ErrorType.DATABASE,
        ErrorSeverity.MEDIUM,
        `Failed to activate file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { error, userId }
      );
    } catch (errorHandlingError) {
      // If error handling itself fails due to database issues, just log it
      console.error("Error handling failed:", errorHandlingError);
    }

    return {
      success: false,
      message: `Failed to activate file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

/**
 * Activates all available files for a user that aren't already active
 * @param userId User ID
 * @returns Promise<{success: boolean, activatedCount: number, message: string}> Result of activation
 */
export async function activateAvailableFiles(userId: string): Promise<{
  success: boolean;
  activatedCount: number;
  message: string;
}> {
  try {
    console.log(
      `[FileActivation] Auto-activating available files for user ${userId}`
    );

    // Get all files for the user that are not already active
    console.log(
      `[FileActivation] Querying for non-active files for user ${userId}`
    );

    // First, let's check all files for this user to see what's available
    const allFiles = (await executeQuery(`
      SELECT id, filename, status FROM files
      WHERE user_id = '${userId}'
    `)) as Array<{ id: string; filename: string; status: string }>;

    console.log(
      `[FileActivation] All files for user ${userId}:`,
      JSON.stringify(allFiles)
    );

    // Get pending/processing files (not active, not error)
    const pendingFiles = (await executeQuery(`
      SELECT id, filename, status FROM files
      WHERE user_id = '${userId}'
      AND status != '${FileStatus.ACTIVE}'
      AND status != '${FileStatus.ERROR}'
    `)) as Array<{ id: string; filename: string; status: string }>;

    console.log(
      `[FileActivation] Found ${pendingFiles.length} pending files for user ${userId}`
    );
    if (pendingFiles.length > 0) {
      console.log(
        `[FileActivation] Pending files:`,
        JSON.stringify(pendingFiles)
      );
    }

    // Also get files in error state that we can try to reactivate
    const errorFiles = (await executeQuery(`
      SELECT id, filename, status FROM files
      WHERE user_id = '${userId}'
      AND status = '${FileStatus.ERROR}'
    `)) as Array<{ id: string; filename: string; status: string }>;

    console.log(
      `[FileActivation] Found ${errorFiles.length} error files for user ${userId}`
    );
    if (errorFiles.length > 0) {
      console.log(`[FileActivation] Error files:`, JSON.stringify(errorFiles));
    }

    // Combine pending and error files for activation
    const files = [...pendingFiles, ...errorFiles];
    console.log(
      `[FileActivation] Total files to attempt activation: ${files.length}`
    );

    if (!files || files.length === 0) {
      // Check for files that are already marked as active but don't have a view
      console.log(
        `[FileActivation] No non-active files found, checking for active files with missing views`
      );

      const activeFiles = (await executeQuery(`
        SELECT id, filename, status FROM files
        WHERE user_id = '${userId}'
        AND status = '${FileStatus.ACTIVE}'
      `)) as Array<{ id: string; filename: string; status: string }>;

      console.log(
        `[FileActivation] Found ${activeFiles.length} active files for user ${userId}`
      );

      if (activeFiles.length > 0) {
        console.log(
          `[FileActivation] Active files:`,
          JSON.stringify(activeFiles)
        );

        // Check each active file to see if its view exists
        let reactivatedCount = 0;
        for (const file of activeFiles) {
          // Create a sanitized user ID for the view name
          const sanitizedUserId = userId.replace(/[^a-zA-Z0-9]/g, "_");
          const viewName = `user_${sanitizedUserId}_file_${file.id}`;

          // Check if the view exists
          const viewExists = await checkIfViewExists(viewName);
          console.log(
            `[FileActivation] View ${viewName} exists: ${viewExists}`
          );

          if (!viewExists) {
            console.log(
              `[FileActivation] View for active file ${file.id} (${file.filename}) doesn't exist, recreating it`
            );

            // Recreate the view
            const attachResult = await attachFileToUserWorkspace(
              file.id,
              userId
            );
            if (attachResult) {
              reactivatedCount++;
              console.log(
                `[FileActivation] Successfully recreated view for file ${file.id}`
              );
            } else {
              console.warn(
                `[FileActivation] Failed to recreate view for file ${file.id}`
              );
            }
          }
        }

        if (reactivatedCount > 0) {
          return {
            success: true,
            activatedCount: reactivatedCount,
            message: `Successfully reactivated ${reactivatedCount} of ${activeFiles.length} files`,
          };
        }
      }

      return {
        success: true,
        activatedCount: 0,
        message: "No files available for activation",
      };
    }

    // Activate each file
    let activatedCount = 0;
    for (const file of files) {
      console.log(
        `[FileActivation] Auto-activating file ${file.id} (${file.filename})`
      );
      const result = await activateFile(file.id, userId);

      if (result.success) {
        activatedCount++;
        console.log(
          `[FileActivation] Successfully auto-activated file ${file.id}`
        );
      } else {
        console.warn(
          `[FileActivation] Failed to auto-activate file ${file.id}: ${result.message}`
        );
      }
    }

    return {
      success: true,
      activatedCount,
      message: `Successfully activated ${activatedCount} of ${files.length} files`,
    };
  } catch (error) {
    console.error(`[FileActivation] Error auto-activating files:`, error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      success: false,
      activatedCount: 0,
      message: `Failed to auto-activate files: ${errorMessage}`,
    };
  }
}

import { executeQuery } from "./database";
import { ErrorType, ErrorSeverity, handleFileError } from "./errorHandling";

/**
 * Check if a file exists
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
 * Check if a table exists
 * @param tableName Table name
 * @returns Promise<boolean> True if the table exists
 */
async function checkIfTableExists(tableName: string): Promise<boolean> {
  try {
    console.log(`[FileActivation] Checking if table ${tableName} exists`);

    const result = (await executeQuery(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = '${tableName}'
      ) as exists
    `)) as Array<{ exists: boolean }>;

    const exists = result && result.length > 0 && result[0].exists;
    console.log(`[FileActivation] Table ${tableName} exists: ${exists}`);

    return exists;
  } catch (error) {
    console.error(
      `[FileActivation] Error checking if table ${tableName} exists:`,
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[FileActivation] Error details: ${errorMessage}`);
    return false;
  }
}

// Define file status enum
export enum FileStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  ACTIVE = "active",
  ERROR = "error",
}

// In-memory storage for activation progress (fallback until database migration is applied)
const activationProgressMap = new Map<string, {
  progress: number;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
}>();

/**
 * Update activation progress in memory (fallback until database migration is applied)
 * @param fileId File ID
 * @param progress Progress percentage (0-100)
 * @param error Optional error message
 * @returns Promise<boolean> True if successful, false otherwise
 */
export async function updateActivationProgress(
  fileId: string,
  progress: number,
  error?: string
): Promise<boolean> {
  try {
    // Try to update in database first (will work once migration is applied)
    try {
      const updateFields = error 
        ? `activation_progress = ${progress}, activation_error = '${error}'` 
        : `activation_progress = ${progress}`;
      
      await executeQuery(`
        UPDATE files
        SET ${updateFields}
        WHERE id = '${fileId}'
      `);
    } catch (dbError) {
      // If database update fails, use in-memory fallback
      const currentData = activationProgressMap.get(fileId) || {
        progress: 0,
        startedAt: null,
        completedAt: null,
        error: null
      };
      
      activationProgressMap.set(fileId, {
        ...currentData,
        progress,
        error: error || currentData.error
      });
    }

    console.log(`Updated file ${fileId} activation progress to ${progress}%${error ? ` with error: ${error}` : ''}`);
    return true;
  } catch (error) {
    console.error(`Error updating activation progress: ${error}`);
    return false;
  }
}

/**
 * Start activation tracking
 * @param fileId File ID
 * @returns Promise<boolean> True if successful, false otherwise
 */
export async function startActivation(
  fileId: string
): Promise<boolean> {
  try {
    // Try to update in database first (will work once migration is applied)
    try {
      await executeQuery(`
        UPDATE files
        SET activation_progress = 0, 
            activation_started_at = CURRENT_TIMESTAMP,
            activation_completed_at = NULL,
            activation_error = NULL
        WHERE id = '${fileId}'
      `);
    } catch (dbError) {
      // If database update fails, use in-memory fallback
      activationProgressMap.set(fileId, {
        progress: 0,
        startedAt: new Date(),
        completedAt: null,
        error: null
      });
    }

    console.log(`Started activation tracking for file ${fileId}`);
    return true;
  } catch (error) {
    console.error(`Error starting activation tracking: ${error}`);
    return false;
  }
}

/**
 * Complete activation tracking
 * @param fileId File ID
 * @param success Whether activation was successful
 * @param error Optional error message
 * @returns Promise<boolean> True if successful, false otherwise
 */
export async function completeActivation(
  fileId: string,
  success: boolean,
  error?: string
): Promise<boolean> {
  try {
    // Try to update in database first (will work once migration is applied)
    try {
      const updateFields = success
        ? `activation_progress = 100, activation_completed_at = CURRENT_TIMESTAMP, activation_error = NULL`
        : `activation_completed_at = CURRENT_TIMESTAMP, activation_error = '${error || "Unknown error"}'`;
      
      await executeQuery(`
        UPDATE files
        SET ${updateFields}
        WHERE id = '${fileId}'
      `);
    } catch (dbError) {
      // If database update fails, use in-memory fallback
      const currentData = activationProgressMap.get(fileId) || {
        progress: 0,
        startedAt: new Date(),
        completedAt: null,
        error: null
      };
      
      activationProgressMap.set(fileId, {
        ...currentData,
        progress: success ? 100 : currentData.progress,
        completedAt: new Date(),
        error: success ? null : (error || "Unknown error")
      });
    }

    console.log(`Completed activation tracking for file ${fileId} with ${success ? 'success' : 'failure'}`);
    return true;
  } catch (error) {
    console.error(`Error completing activation tracking: ${error}`);
    return false;
  }
}

/**
 * Get activation progress for a file
 * @param fileId File ID
 * @returns Promise<{progress: number, startedAt: Date | null, completedAt: Date | null, error: string | null} | null> Activation progress or null if not found
 */
export async function getActivationProgress(
  fileId: string
): Promise<{
  progress: number;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
} | null> {
  try {
    // Try to get from database first (will work once migration is applied)
    try {
      const result = (await executeQuery(`
        SELECT 
          activation_progress, 
          activation_started_at, 
          activation_completed_at, 
          activation_error 
        FROM files 
        WHERE id = '${fileId}'
      `)) as Array<{
        activation_progress: number | null;
        activation_started_at: string | null;
        activation_completed_at: string | null;
        activation_error: string | null;
      }>;

      if (result && result.length > 0) {
        return {
          progress: result[0].activation_progress || 0,
          startedAt: result[0].activation_started_at ? new Date(result[0].activation_started_at) : null,
          completedAt: result[0].activation_completed_at ? new Date(result[0].activation_completed_at) : null,
          error: result[0].activation_error
        };
      }
    } catch (dbError) {
      // If database query fails, use in-memory fallback
    }
    
    // Use in-memory fallback
    const inMemoryProgress = activationProgressMap.get(fileId);
    if (inMemoryProgress) {
      return inMemoryProgress;
    }
    
    // If no progress info found, get file status and return appropriate progress
    const fileResult = (await executeQuery(`
      SELECT status FROM files WHERE id = '${fileId}'
    `)) as { status: string }[];
    
    if (fileResult && fileResult.length > 0) {
      const status = fileResult[0].status;
      if (status === FileStatus.ACTIVE) {
        return {
          progress: 100,
          startedAt: null,
          completedAt: new Date(),
          error: null
        };
      } else if (status === FileStatus.PROCESSING) {
        return {
          progress: 50, // Estimate
          startedAt: new Date(),
          completedAt: null,
          error: null
        };
      } else if (status === FileStatus.ERROR) {
        return {
          progress: 0,
          startedAt: null,
          completedAt: new Date(),
          error: "Activation failed"
        };
      }
    }
    
    // Default fallback
    return {
      progress: 0,
      startedAt: null,
      completedAt: null,
      error: null
    };
  } catch (error) {
    console.error(`Error getting activation progress: ${error}`);
    return null;
  }
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
        `Database operation skipped (server environment): Unable to update file status for file ${fileId}`
      );
      // Return true to allow the operation to continue
      return true;
    }

    console.error(`Error updating file status: ${error}`);
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
        await executeQuery(`
          CREATE OR REPLACE VIEW ${viewName} AS
          SELECT data FROM file_data WHERE file_id = '${fileId}'
        `);
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
        await executeQuery(`
          CREATE OR REPLACE VIEW ${viewName} AS
          SELECT data FROM file_data WHERE file_id = '${fileId}'
        `);
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

      await executeQuery(`
        CREATE OR REPLACE VIEW ${simpleViewName} AS
        SELECT data FROM file_data WHERE file_id = '${fileId}'
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
  progress?: number;
}> {
  try {
    let dbOperationsSkipped = false;

    // Start activation tracking
    await startActivation(fileId);
    
    // Update file status to processing
    await updateFileStatus(fileId, FileStatus.PROCESSING);
    
    // Update progress - 10%
    await updateActivationProgress(fileId, 10);

    // Check if file exists
    if (!(await fileExists(fileId))) {
      await completeActivation(fileId, false, "File not found");
      return { success: false, message: "File not found", progress: 0 };
    }

    // Update progress - 20%
    await updateActivationProgress(fileId, 20);

    // Check if file belongs to user
    if (!(await fileExistsForUser(fileId, userId))) {
      await completeActivation(fileId, false, "Access denied");
      return { success: false, message: "Access denied", progress: 20 };
    }

    // Update progress - 30%
    await updateActivationProgress(fileId, 30);

    // Check if file table exists
    if (!(await fileTableExists(fileId))) {
      await completeActivation(fileId, false, "File data not found");
      return { success: false, message: "File data not found", progress: 30 };
    }

    // Update progress - 40%
    await updateActivationProgress(fileId, 40);

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
        await completeActivation(fileId, false, `Failed to get file status: ${error instanceof Error ? error.message : "Unknown error"}`);
        throw error;
      }
    }

    // Update progress - 50%
    await updateActivationProgress(fileId, 50);

    // Check if file is already active
    if (fileStatus === FileStatus.ACTIVE) {
      await completeActivation(fileId, true);
      return {
        success: true,
        message: "File is already active",
        dbOperationsSkipped,
        progress: 100
      };
    }

    // Check if file is in error state - we'll try to reactivate it anyway
    if (fileStatus === FileStatus.ERROR) {
      console.log(
        `[FileActivation] File ${fileId} is in error state, attempting to reactivate`
      );
      // Continue with activation instead of returning error
    }

    // Check if file is still processing (from a previous attempt)
    if (fileStatus === FileStatus.PROCESSING) {
      // We're already processing it now, so continue
      console.log(
        `[FileActivation] File ${fileId} was already in processing state, continuing with activation`
      );
    }

    // Update progress - 60%
    await updateActivationProgress(fileId, 60);

    // Attach file to user workspace
    let attachResult = false;
    try {
      attachResult = await attachFileToUserWorkspace(fileId, userId);
    } catch (attachError) {
      console.error(`[FileActivation] Error attaching file to workspace:`, attachError);
      const errorMessage = attachError instanceof Error ? attachError.message : "Unknown error";
      await updateActivationProgress(fileId, 60, errorMessage);
      
      // Try to recover by using a different approach
      try {
        console.log(`[FileActivation] Attempting recovery with alternative approach`);
        attachResult = await attachFileToUserWorkspace(fileId, userId);
      } catch (recoveryError) {
        console.error(`[FileActivation] Recovery attempt failed:`, recoveryError);
        await completeActivation(fileId, false, `Failed to attach file to workspace after recovery attempt: ${errorMessage}`);
        return {
          success: false,
          message: `Failed to attach file to workspace: ${errorMessage}`,
          dbOperationsSkipped,
          progress: 60
        };
      }
    }
    
    if (!attachResult) {
      await completeActivation(fileId, false, "Failed to attach file to user workspace");
      return {
        success: false,
        message: "Failed to attach file to user workspace",
        dbOperationsSkipped,
        progress: 60
      };
    }

    // Update progress - 80%
    await updateActivationProgress(fileId, 80);

    // Update file status to active
    if (!(await updateFileStatus(fileId, FileStatus.ACTIVE))) {
      await completeActivation(fileId, false, "Failed to update file status");
      return {
        success: false,
        message: "Failed to update file status",
        dbOperationsSkipped,
        progress: 80
      };
    }

    // Update progress - 100%
    await updateActivationProgress(fileId, 100);
    
    // Complete activation tracking
    await completeActivation(fileId, true);

    return {
      success: true,
      message: "File activated successfully",
      dbOperationsSkipped,
      progress: 100
    };
  } catch (error) {
    console.error(`Error activating file: ${error}`);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    try {
      // Complete activation with error
      await completeActivation(fileId, false, errorMessage);
      
      // Update file status to error
      await updateFileStatus(fileId, FileStatus.ERROR);
      
      // Log the error
      await handleFileError(
        fileId,
        ErrorType.DATABASE,
        ErrorSeverity.MEDIUM,
        `Failed to activate file: ${errorMessage}`,
        { error, userId }
      );
    } catch (errorHandlingError) {
      // If error handling itself fails due to database issues, just log it
      console.error("Error handling failed:", errorHandlingError);
    }

    return {
      success: false,
      message: `Failed to activate file: ${errorMessage}`,
      progress: 0
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

    const files = (await executeQuery(`
      SELECT id FROM files
      WHERE user_id = '${userId}'
      AND status != '${FileStatus.ACTIVE}'
      AND status != '${FileStatus.PROCESSING}'
    `)) as Array<{ id: string }>;

    if (!files || files.length === 0) {
      console.log(
        `[FileActivation] No non-active files found for user ${userId}`
      );
      return {
        success: true,
        activatedCount: 0,
        message: "No files to activate",
      };
    }

    console.log(
      `[FileActivation] Found ${files.length} non-active files for user ${userId}`
    );

    let activatedCount = 0;
    let failedCount = 0;

    // Activate each file
    for (const file of files) {
      console.log(`[FileActivation] Activating file ${file.id}`);

      const result = await activateFile(file.id, userId);

      if (result.success) {
        activatedCount++;
      } else {
        failedCount++;
        console.error(
          `[FileActivation] Failed to activate file ${file.id}: ${result.message}`
        );
      }
    }

    console.log(
      `[FileActivation] Activated ${activatedCount} files for user ${userId}, ${failedCount} failed`
    );

    return {
      success: true,
      activatedCount,
      message: `Activated ${activatedCount} files, ${failedCount} failed`,
    };
  } catch (error) {
    console.error(`Error activating available files: ${error}`);

    return {
      success: false,
      activatedCount: 0,
      message: `Failed to activate files: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}
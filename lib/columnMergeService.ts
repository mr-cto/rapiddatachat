import { executeQuery } from "./database";
import { handleFileError, ErrorType, ErrorSeverity } from "./errorHandling";
import { PrismaClient } from "@prisma/client";

// Initialize Prisma client (singleton)
let prismaInstance: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

/**
 * Check if a view exists
 * @param viewName View name
 * @returns Promise<boolean> True if the view exists
 */
async function checkIfViewExists(viewName: string): Promise<boolean> {
  try {
    console.log(`[ColumnMergeService] Checking if view ${viewName} exists`);

    const result = (await executeQuery(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_name = '${viewName}'
      ) as exists
    `)) as Array<{ exists: boolean }>;

    const exists = result && result.length > 0 && result[0].exists;
    console.log(`[ColumnMergeService] View ${viewName} exists: ${exists}`);

    return exists;
  } catch (error) {
    console.error(
      `[ColumnMergeService] Error checking if view ${viewName} exists:`,
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[ColumnMergeService] Error details: ${errorMessage}`);
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
    console.log(`[ColumnMergeService] Checking if table ${tableName} exists`);

    const result = (await executeQuery(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = '${tableName}'
      ) as exists
    `)) as Array<{ exists: boolean }>;

    const exists = result && result.length > 0 && result[0].exists;
    console.log(`[ColumnMergeService] Table ${tableName} exists: ${exists}`);

    return exists;
  } catch (error) {
    console.error(
      `[ColumnMergeService] Error checking if table ${tableName} exists:`,
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[ColumnMergeService] Error details: ${errorMessage}`);
    return false;
  }
}

/**
 * Interface for column merge configuration
 */
export interface ColumnMergeConfig {
  id: string;
  userId: string;
  fileId: string;
  mergeName: string;
  columnList: string[];
  delimiter: string;
}

/**
 * Create a view for a merged column
 * @param mergeConfig Column merge configuration
 * @returns Promise<{success: boolean, viewName: string, message: string}> Result of view creation
 */
export async function createMergedColumnView(
  mergeConfig: ColumnMergeConfig
): Promise<{ success: boolean; viewName: string; message: string }> {
  try {
    console.log(
      `[ColumnMergeService] Creating merged column view for ${mergeConfig.mergeName}`
    );

    // Create a sanitized view name
    const sanitizedUserId = mergeConfig.userId.replace(/[^a-zA-Z0-9]/g, "_");
    const sanitizedMergeName = mergeConfig.mergeName.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    );
    const viewName = `merged_${sanitizedUserId}_${mergeConfig.fileId.replace(
      /-/g,
      "_"
    )}_${sanitizedMergeName}`;

    // Check if the view already exists
    const viewExists = await checkIfViewExists(viewName);
    if (viewExists) {
      console.log(
        `[ColumnMergeService] View ${viewName} already exists, updating it`
      );
    }

    // Get the base view name for the file
    const baseViewName = `data_${sanitizedUserId}_${mergeConfig.fileId.replace(
      /-/g,
      "_"
    )}`;

    // Check if the base view exists
    const baseViewExists = await checkIfViewExists(baseViewName);
    if (!baseViewExists) {
      // Try alternative base view name
      const alternativeBaseViewName = `data_file_${mergeConfig.fileId.replace(
        /-/g,
        "_"
      )}`;
      const alternativeBaseViewExists = await checkIfViewExists(
        alternativeBaseViewName
      );

      if (!alternativeBaseViewExists) {
        return {
          success: false,
          viewName: "",
          message: `Base view for file ${mergeConfig.fileId} does not exist`,
        };
      }
    }

    // Generate SQL for concatenating columns with delimiter
    let concatExpr = "";

    if (mergeConfig.columnList.length === 1) {
      // If there's only one column, just use it directly
      concatExpr = `TRIM(COALESCE(data->>'${mergeConfig.columnList[0]}', ''))`;
    } else {
      // For multiple columns, use a more sophisticated approach to handle empty values
      // Create an array of trimmed values
      const colExprs = mergeConfig.columnList.map(
        (col) => `TRIM(COALESCE(data->>'${col}', ''))`
      );

      // Use a CASE expression to check if each value is empty
      // Only include the delimiter if both adjacent values are non-empty
      const parts = [];

      for (let i = 0; i < colExprs.length; i++) {
        // For the first element, just add it
        if (i === 0) {
          parts.push(colExprs[i]);
        } else {
          // For subsequent elements, add the delimiter only if both this element and the previous are non-empty
          parts.push(`CASE
            WHEN ${colExprs[i - 1]} <> '' AND ${colExprs[i]} <> ''
            THEN '${mergeConfig.delimiter}'
            ELSE ''
          END`);
          parts.push(colExprs[i]);
        }
      }

      concatExpr = parts.join(" || ");
    }

    // Create the view SQL
    const viewSql = `
      CREATE OR REPLACE VIEW ${viewName} AS
      SELECT *, ${concatExpr} AS ${sanitizedMergeName}
      FROM ${
        baseViewExists
          ? baseViewName
          : `data_file_${mergeConfig.fileId.replace(/-/g, "_")}`
      }
    `;

    console.log(`[ColumnMergeService] Executing view creation SQL: ${viewSql}`);

    // Execute the SQL
    await executeQuery(viewSql);

    // Store the view metadata if the view_metadata table exists
    const viewMetadataExists = await checkIfTableExists("view_metadata");
    if (viewMetadataExists) {
      await executeQuery(`
        INSERT INTO view_metadata (view_name, file_id, user_id, original_filename, is_merged_view, merged_columns, delimiter)
        VALUES (
          '${viewName}', 
          '${mergeConfig.fileId}', 
          '${mergeConfig.userId}', 
          '${mergeConfig.mergeName}',
          true,
          '${JSON.stringify(mergeConfig.columnList)}',
          '${mergeConfig.delimiter}'
        )
        ON CONFLICT (view_name)
        DO UPDATE SET
          file_id = EXCLUDED.file_id,
          user_id = EXCLUDED.user_id,
          original_filename = EXCLUDED.original_filename,
          is_merged_view = EXCLUDED.is_merged_view,
          merged_columns = EXCLUDED.merged_columns,
          delimiter = EXCLUDED.delimiter,
          created_at = CURRENT_TIMESTAMP
      `);
    }

    console.log(`[ColumnMergeService] Successfully created view ${viewName}`);
    return {
      success: true,
      viewName,
      message: `Successfully created merged column view ${viewName}`,
    };
  } catch (error) {
    console.error(
      `[ColumnMergeService] Error creating merged column view:`,
      error
    );

    // Handle the error
    try {
      await handleFileError(
        mergeConfig.fileId,
        ErrorType.DATABASE,
        ErrorSeverity.MEDIUM,
        `Failed to create merged column view: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { error, userId: mergeConfig.userId, mergeName: mergeConfig.mergeName }
      );
    } catch (errorHandlingError) {
      console.error("Error handling failed:", errorHandlingError);
    }

    return {
      success: false,
      viewName: "",
      message: `Failed to create merged column view: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

/**
 * Update a view for a merged column
 * @param mergeConfig Column merge configuration
 * @returns Promise<{success: boolean, viewName: string, message: string}> Result of view update
 */
export async function updateMergedColumnView(
  mergeConfig: ColumnMergeConfig
): Promise<{ success: boolean; viewName: string; message: string }> {
  try {
    console.log(
      `[ColumnMergeService] Updating merged column view for ${mergeConfig.mergeName}`
    );

    // Create a sanitized view name
    const sanitizedUserId = mergeConfig.userId.replace(/[^a-zA-Z0-9]/g, "_");
    const sanitizedMergeName = mergeConfig.mergeName.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    );
    const viewName = `merged_${sanitizedUserId}_${mergeConfig.fileId.replace(
      /-/g,
      "_"
    )}_${sanitizedMergeName}`;

    // Check if the view exists
    const viewExists = await checkIfViewExists(viewName);
    if (!viewExists) {
      console.log(
        `[ColumnMergeService] View ${viewName} does not exist, creating it`
      );
      return createMergedColumnView(mergeConfig);
    }

    // Get the base view name for the file
    const baseViewName = `data_${sanitizedUserId}_${mergeConfig.fileId.replace(
      /-/g,
      "_"
    )}`;

    // Check if the base view exists
    const baseViewExists = await checkIfViewExists(baseViewName);
    if (!baseViewExists) {
      // Try alternative base view name
      const alternativeBaseViewName = `data_file_${mergeConfig.fileId.replace(
        /-/g,
        "_"
      )}`;
      const alternativeBaseViewExists = await checkIfViewExists(
        alternativeBaseViewName
      );

      if (!alternativeBaseViewExists) {
        return {
          success: false,
          viewName: "",
          message: `Base view for file ${mergeConfig.fileId} does not exist`,
        };
      }
    }

    // Generate SQL for concatenating columns with delimiter
    let concatExpr = "";

    if (mergeConfig.columnList.length === 1) {
      // If there's only one column, just use it directly
      concatExpr = `TRIM(COALESCE(data->>'${mergeConfig.columnList[0]}', ''))`;
    } else {
      // For multiple columns, use a more sophisticated approach to handle empty values
      // Create an array of trimmed values
      const colExprs = mergeConfig.columnList.map(
        (col) => `TRIM(COALESCE(data->>'${col}', ''))`
      );

      // Use a CASE expression to check if each value is empty
      // Only include the delimiter if both adjacent values are non-empty
      const parts = [];

      for (let i = 0; i < colExprs.length; i++) {
        // For the first element, just add it
        if (i === 0) {
          parts.push(colExprs[i]);
        } else {
          // For subsequent elements, add the delimiter only if both this element and the previous are non-empty
          parts.push(`CASE
            WHEN ${colExprs[i - 1]} <> '' AND ${colExprs[i]} <> ''
            THEN '${mergeConfig.delimiter}'
            ELSE ''
          END`);
          parts.push(colExprs[i]);
        }
      }

      concatExpr = parts.join(" || ");
    }

    // Create the view SQL
    const viewSql = `
      CREATE OR REPLACE VIEW ${viewName} AS
      SELECT *, ${concatExpr} AS ${sanitizedMergeName}
      FROM ${
        baseViewExists
          ? baseViewName
          : `data_file_${mergeConfig.fileId.replace(/-/g, "_")}`
      }
    `;

    console.log(`[ColumnMergeService] Executing view update SQL: ${viewSql}`);

    // Execute the SQL
    await executeQuery(viewSql);

    // Update the view metadata if the view_metadata table exists
    const viewMetadataExists = await checkIfTableExists("view_metadata");
    if (viewMetadataExists) {
      await executeQuery(`
        UPDATE view_metadata
        SET 
          file_id = '${mergeConfig.fileId}',
          user_id = '${mergeConfig.userId}',
          original_filename = '${mergeConfig.mergeName}',
          is_merged_view = true,
          merged_columns = '${JSON.stringify(mergeConfig.columnList)}',
          delimiter = '${mergeConfig.delimiter}',
          updated_at = CURRENT_TIMESTAMP
        WHERE view_name = '${viewName}'
      `);
    }

    console.log(`[ColumnMergeService] Successfully updated view ${viewName}`);
    return {
      success: true,
      viewName,
      message: `Successfully updated merged column view ${viewName}`,
    };
  } catch (error) {
    console.error(
      `[ColumnMergeService] Error updating merged column view:`,
      error
    );

    // Handle the error
    try {
      await handleFileError(
        mergeConfig.fileId,
        ErrorType.DATABASE,
        ErrorSeverity.MEDIUM,
        `Failed to update merged column view: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { error, userId: mergeConfig.userId, mergeName: mergeConfig.mergeName }
      );
    } catch (errorHandlingError) {
      console.error("Error handling failed:", errorHandlingError);
    }

    return {
      success: false,
      viewName: "",
      message: `Failed to update merged column view: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

/**
 * Drop a view for a merged column
 * @param mergeConfig Column merge configuration
 * @returns Promise<{success: boolean, message: string}> Result of view deletion
 */
export async function dropMergedColumnView(
  mergeConfig: ColumnMergeConfig
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(
      `[ColumnMergeService] Dropping merged column view for ${mergeConfig.mergeName}`
    );

    // Create a sanitized view name
    const sanitizedUserId = mergeConfig.userId.replace(/[^a-zA-Z0-9]/g, "_");
    const sanitizedMergeName = mergeConfig.mergeName.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    );
    const viewName = `merged_${sanitizedUserId}_${mergeConfig.fileId.replace(
      /-/g,
      "_"
    )}_${sanitizedMergeName}`;

    // Check if the view exists
    const viewExists = await checkIfViewExists(viewName);
    if (!viewExists) {
      console.log(
        `[ColumnMergeService] View ${viewName} does not exist, nothing to drop`
      );
      return {
        success: true,
        message: `View ${viewName} does not exist, nothing to drop`,
      };
    }

    // Drop the view
    const dropSql = `DROP VIEW IF EXISTS ${viewName}`;
    console.log(`[ColumnMergeService] Executing view drop SQL: ${dropSql}`);
    await executeQuery(dropSql);

    // Remove the view metadata if the view_metadata table exists
    const viewMetadataExists = await checkIfTableExists("view_metadata");
    if (viewMetadataExists) {
      await executeQuery(`
        DELETE FROM view_metadata
        WHERE view_name = '${viewName}'
      `);
    }

    console.log(`[ColumnMergeService] Successfully dropped view ${viewName}`);
    return {
      success: true,
      message: `Successfully dropped merged column view ${viewName}`,
    };
  } catch (error) {
    console.error(
      `[ColumnMergeService] Error dropping merged column view:`,
      error
    );

    // Handle the error
    try {
      await handleFileError(
        mergeConfig.fileId,
        ErrorType.DATABASE,
        ErrorSeverity.MEDIUM,
        `Failed to drop merged column view: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { error, userId: mergeConfig.userId, mergeName: mergeConfig.mergeName }
      );
    } catch (errorHandlingError) {
      console.error("Error handling failed:", errorHandlingError);
    }

    return {
      success: false,
      message: `Failed to drop merged column view: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

/**
 * Get all merged column views for a user and file
 * @param userId User ID
 * @param fileId File ID
 * @returns Promise<Array<{viewName: string, mergeName: string, columnList: string[], delimiter: string}>> Merged column views
 */
export async function getMergedColumnViews(
  userId: string,
  fileId: string
): Promise<
  Array<{
    viewName: string;
    mergeName: string;
    columnList: string[];
    delimiter: string;
  }>
> {
  try {
    console.log(
      `[ColumnMergeService] Getting merged column views for user ${userId} and file ${fileId}`
    );

    // Check if the view_metadata table exists
    const viewMetadataExists = await checkIfTableExists("view_metadata");
    if (!viewMetadataExists) {
      console.log(
        `[ColumnMergeService] view_metadata table does not exist, using Prisma to get merged columns`
      );

      // Use Prisma to get the merged columns
      const prisma = getPrismaClient();

      // Since we're in development and might not have regenerated the Prisma client yet,
      // let's use a more generic approach with executeQuery
      const mergedColumns = (await executeQuery(`
        SELECT id, user_id, file_id, merge_name, column_list, delimiter
        FROM column_merges
        WHERE user_id = '${userId}' AND file_id = '${fileId}'
      `)) as Array<{
        id: string;
        user_id: string;
        file_id: string;
        merge_name: string;
        column_list: string[];
        delimiter: string;
      }>;

      // Convert to the expected format
      return (mergedColumns || []).map((merge) => {
        const sanitizedUserId = userId.replace(/[^a-zA-Z0-9]/g, "_");
        const sanitizedMergeName = merge.merge_name.replace(
          /[^a-zA-Z0-9]/g,
          "_"
        );
        const viewName = `merged_${sanitizedUserId}_${fileId.replace(
          /-/g,
          "_"
        )}_${sanitizedMergeName}`;

        return {
          viewName,
          mergeName: merge.merge_name,
          columnList: merge.column_list,
          delimiter: merge.delimiter,
        };
      });
    }

    // Get the merged column views from the view_metadata table
    const result = (await executeQuery(`
      SELECT view_name, original_filename, merged_columns, delimiter
      FROM view_metadata
      WHERE user_id = '${userId}' AND file_id = '${fileId}' AND is_merged_view = true
    `)) as Array<{
      view_name: string;
      original_filename: string;
      merged_columns: string;
      delimiter: string;
    }>;

    // Convert the result to the expected format
    return (result || []).map((row) => ({
      viewName: row.view_name,
      mergeName: row.original_filename,
      columnList: JSON.parse(row.merged_columns),
      delimiter: row.delimiter,
    }));
  } catch (error) {
    console.error(
      `[ColumnMergeService] Error getting merged column views:`,
      error
    );
    return [];
  }
}

/**
 * Get a specific merged column view
 * @param userId User ID
 * @param fileId File ID
 * @param mergeName Merge name
 * @returns Promise<{viewName: string, mergeName: string, columnList: string[], delimiter: string} | null> Merged column view
 */
export async function getMergedColumnView(
  userId: string,
  fileId: string,
  mergeName: string
): Promise<{
  viewName: string;
  mergeName: string;
  columnList: string[];
  delimiter: string;
} | null> {
  try {
    console.log(
      `[ColumnMergeService] Getting merged column view ${mergeName} for user ${userId} and file ${fileId}`
    );

    // Check if the view_metadata table exists
    const viewMetadataExists = await checkIfTableExists("view_metadata");
    if (!viewMetadataExists) {
      console.log(
        `[ColumnMergeService] view_metadata table does not exist, using Prisma to get merged column`
      );

      // Use executeQuery instead of Prisma client directly
      const mergedColumn = (await executeQuery(`
        SELECT id, user_id, file_id, merge_name, column_list, delimiter
        FROM column_merges
        WHERE user_id = '${userId}' AND file_id = '${fileId}' AND merge_name = '${mergeName}'
        LIMIT 1
      `)) as Array<{
        id: string;
        user_id: string;
        file_id: string;
        merge_name: string;
        column_list: string[];
        delimiter: string;
      }>;

      if (!mergedColumn || mergedColumn.length === 0) {
        return null;
      }

      // Convert to the expected format
      const sanitizedUserId = userId.replace(/[^a-zA-Z0-9]/g, "_");
      const sanitizedMergeName = mergeName.replace(/[^a-zA-Z0-9]/g, "_");
      const viewName = `merged_${sanitizedUserId}_${fileId.replace(
        /-/g,
        "_"
      )}_${sanitizedMergeName}`;

      return {
        viewName,
        mergeName: mergedColumn[0].merge_name,
        columnList: mergedColumn[0].column_list,
        delimiter: mergedColumn[0].delimiter,
      };
    }

    // Get the merged column view from the view_metadata table
    const result = (await executeQuery(`
      SELECT view_name, original_filename, merged_columns, delimiter
      FROM view_metadata
      WHERE user_id = '${userId}' AND file_id = '${fileId}' AND original_filename = '${mergeName}' AND is_merged_view = true
    `)) as Array<{
      view_name: string;
      original_filename: string;
      merged_columns: string;
      delimiter: string;
    }>;

    if (!result || result.length === 0) {
      return null;
    }

    // Convert the result to the expected format
    return {
      viewName: result[0].view_name,
      mergeName: result[0].original_filename,
      columnList: JSON.parse(result[0].merged_columns),
      delimiter: result[0].delimiter,
    };
  } catch (error) {
    console.error(
      `[ColumnMergeService] Error getting merged column view:`,
      error
    );
    return null;
  }
}

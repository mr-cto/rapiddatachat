import { executeQuery } from "../database";
import { getMergedColumnViews } from "../columnMergeService";

// Define the interface for a table column
interface Column {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: {
    table: string;
    column: string;
  };
}

// Define the interface for a table
interface Table {
  name: string;
  columns: Column[];
  rowCount: number;
  viewName?: string; // Optional view name for the table
}

// Define the interface for the database schema
interface DatabaseSchema {
  tables: Table[];
}

// Define the interface for merged columns
interface MergedColumn {
  viewName: string;
  mergeName: string;
  columnList: string[];
  delimiter: string;
}

/**
 * SchemaService class for gathering and managing database schema information
 * This service is responsible for extracting schema information from the database
 */
export class SchemaService {
  /**
   * Get schema information for all active tables
   * @param userId User ID
   * @returns Promise<DatabaseSchema> Database schema information
   */
  async getSchemaForActiveTables(userId: string): Promise<DatabaseSchema> {
    try {
      console.log(
        `[SchemaService] Getting schema for active tables for user: ${userId}`
      );

      // Get all active files for the user
      console.log(
        `[DEBUG] About to call getActiveFilesForUser for user: ${userId}`
      );
      const activeFiles = await this.getActiveFilesForUser(userId);
      console.log(
        `[SchemaService] Found ${activeFiles.length} active files for user ${userId}`
      );

      if (activeFiles.length === 0) {
        console.log(
          `[DEBUG] No active files found for user ${userId}. This will cause schema creation to fail.`
        );
      } else {
        console.log(
          `[SchemaService] Active file IDs: ${activeFiles
            .map((f) => f.id)
            .join(", ")}`
        );
      }

      // Get all view metadata for this user
      const viewMetadata = await this.getViewMetadataForUser(userId);
      console.log(
        `[SchemaService] Found ${viewMetadata.length} view metadata entries for user ${userId}`
      );

      // Get schema information for each active file
      const tables: Table[] = [];
      for (const file of activeFiles) {
        console.log(
          `[SchemaService] Getting schema for file ${file.id} (${file.filename})`
        );

        // Find the view metadata for this file
        const metadata = viewMetadata.find((vm) => vm.file_id === file.id);

        if (metadata) {
          console.log(
            `[SchemaService] Found view metadata for file ${file.id}: ${metadata.view_name}`
          );

          const table = await this.getSchemaForFileWithView(
            file.id,
            userId,
            metadata.view_name,
            file.filename
          );
          if (table) {
            console.log(
              `[SchemaService] Successfully retrieved schema for file ${file.id}: ${table.columns.length} columns, ${table.rowCount} rows`
            );
            tables.push(table);
          } else {
            console.log(
              `[SchemaService] Failed to retrieve schema for file ${file.id} with view ${metadata.view_name}, trying to recreate view`
            );

            // Try to recreate the view by reactivating the file
            try {
              // Use the simplified version that doesn't rely on activation_progress columns
              const { activateFile } = require("../fileActivationSimple.js");
              const result = await activateFile(file.id, userId);

              if (result.success) {
                console.log(
                  `[SchemaService] Successfully reactivated file ${file.id}`
                );

                // Try again with the schema retrieval
                const retryTable = await this.getSchemaForFile(file.id, userId);
                if (retryTable) {
                  console.log(
                    `[SchemaService] Successfully retrieved schema for file ${file.id} after reactivation: ${retryTable.columns.length} columns, ${retryTable.rowCount} rows`
                  );
                  tables.push(retryTable);
                } else {
                  console.log(
                    `[SchemaService] Failed to retrieve schema for file ${file.id} even after reactivation`
                  );
                }
              } else {
                console.log(
                  `[SchemaService] Failed to reactivate file ${file.id}: ${result.message}`
                );
              }
            } catch (reactivationError) {
              console.error(
                `[SchemaService] Error reactivating file ${file.id}:`,
                reactivationError
              );
            }
          }
        } else {
          console.log(
            `[SchemaService] No view metadata found for file ${file.id}, using fallback method`
          );

          const table = await this.getSchemaForFile(file.id, userId);
          if (table) {
            console.log(
              `[SchemaService] Successfully retrieved schema for file ${file.id}: ${table.columns.length} columns, ${table.rowCount} rows`
            );
            tables.push(table);
          } else {
            console.log(
              `[SchemaService] Failed to retrieve schema for file ${file.id}, trying to reactivate file`
            );

            // Try to recreate the view by reactivating the file
            try {
              // Use the simplified version that doesn't rely on activation_progress columns
              const { activateFile } = require("../fileActivationSimple.js");
              const result = await activateFile(file.id, userId);

              if (result.success) {
                console.log(
                  `[SchemaService] Successfully reactivated file ${file.id}`
                );

                // Try again with the schema retrieval
                const retryTable = await this.getSchemaForFile(file.id, userId);
                if (retryTable) {
                  console.log(
                    `[SchemaService] Successfully retrieved schema for file ${file.id} after reactivation: ${retryTable.columns.length} columns, ${retryTable.rowCount} rows`
                  );
                  tables.push(retryTable);
                } else {
                  console.log(
                    `[SchemaService] Failed to retrieve schema for file ${file.id} even after reactivation`
                  );
                }
              } else {
                console.log(
                  `[SchemaService] Failed to reactivate file ${file.id}: ${result.message}`
                );
              }
            } catch (reactivationError) {
              console.error(
                `[SchemaService] Error reactivating file ${file.id}:`,
                reactivationError
              );
            }
          }
        }
      }

      console.log(
        `[SchemaService] Returning schema with ${tables.length} tables`
      );
      return { tables };
    } catch (error) {
      console.error(
        "[SchemaService] Error getting schema for active tables:",
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[SchemaService] Error details: ${errorMessage}`);
      return { tables: [] };
    }
  }

  /**
   * Get active files for a user
   * @param userId User ID
   * @returns Promise<Array<{ id: string; filename: string }>> Active files
   */
  private async getActiveFilesForUser(
    userId: string
  ): Promise<Array<{ id: string; filename: string }>> {
    try {
      console.log(`[SchemaService] Getting active files for user: ${userId}`);

      // First check if the files table exists
      const tableExists = await this.checkIfTableExists("files");
      console.log(`[DEBUG] files table exists: ${tableExists}`);

      if (!tableExists) {
        console.log(
          `[DEBUG] files table does not exist, returning empty array`
        );
        return [];
      }

      // Get all files to see what's in the database
      const allFiles = await executeQuery(
        `SELECT id, filename, user_id, status FROM files`
      );
      console.log(`[DEBUG] All files in database:`, allFiles);

      // Check if there are any files with the exact user ID
      console.log(
        `[DEBUG] SQL query: SELECT id, filename FROM files WHERE user_id = '${userId}' AND status = 'active'`
      );
      let result = (await executeQuery(`
        SELECT id, filename FROM files
        WHERE user_id = '${userId}' AND status = 'active'
      `)) as Array<{ id: string; filename: string }>;

      // If no results found and userId looks like a Google ID (numeric), try to find files by email
      if ((!result || result.length === 0) && /^\d+$/.test(userId)) {
        console.log(
          `[DEBUG] No files found with numeric ID ${userId}, checking for files with email user_id`
        );

        // Look for any active files in the system since we can't determine the email
        // This is a fallback to show any active files to the user
        result = (await executeQuery(`
          SELECT id, filename FROM files
          WHERE status = 'active'
          LIMIT 10
        `)) as Array<{ id: string; filename: string }>;

        console.log(
          `[DEBUG] Found ${result.length} active files in the system as fallback`
        );
      }

      console.log(
        `[SchemaService] Query result for active files: ${
          result ? `${result.length} files found` : "null result"
        }`
      );

      if (result && result.length > 0) {
        console.log(`[DEBUG] Active files found:`, result);
      } else {
        console.log(`[DEBUG] No active files found for user ${userId}`);
      }

      return result || [];
    } catch (error) {
      console.error(
        "[SchemaService] Error getting active files for user:",
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[SchemaService] Error details: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Get view metadata for a user
   * @param userId User ID
   * @returns Promise<Array<{ view_name: string; file_id: string; original_filename: string }>> View metadata
   */
  private async getViewMetadataForUser(
    userId: string
  ): Promise<
    Array<{ view_name: string; file_id: string; original_filename: string }>
  > {
    try {
      console.log(`[SchemaService] Getting view metadata for user: ${userId}`);

      // Check if the view_metadata table exists
      const tableExists = await this.checkIfTableExists("view_metadata");
      if (!tableExists) {
        console.log(
          `[SchemaService] view_metadata table does not exist, returning empty array`
        );
        return [];
      }

      const result = (await executeQuery(`
        SELECT view_name, file_id, original_filename FROM view_metadata
        WHERE user_id = '${userId}'
      `)) as Array<{
        view_name: string;
        file_id: string;
        original_filename: string;
      }>;

      console.log(
        `[SchemaService] Query result for view metadata: ${
          result ? `${result.length} entries found` : "null result"
        }`
      );

      return result || [];
    } catch (error) {
      console.error(
        "[SchemaService] Error getting view metadata for user:",
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[SchemaService] Error details: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Check if a table exists
   * @param tableName Table name
   * @returns Promise<boolean> True if the table exists
   */
  private async checkIfTableExists(tableName: string): Promise<boolean> {
    try {
      console.log(`[SchemaService] Checking if table ${tableName} exists`);

      const result = (await executeQuery(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = '${tableName}'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      const exists = result && result.length > 0 && result[0].exists;
      console.log(`[SchemaService] Table ${tableName} exists: ${exists}`);

      return exists;
    } catch (error) {
      console.error(
        `[SchemaService] Error checking if table ${tableName} exists:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[SchemaService] Error details: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Get schema information for a file
   * @param fileId File ID
   * @param userId User ID
   * @returns Promise<Table | null> Table schema information
   */
  private async getSchemaForFile(
    fileId: string,
    userId: string
  ): Promise<Table | null> {
    try {
      console.log(
        `[SchemaService] Getting schema for file ${fileId} for user ${userId}`
      );

      // Get the first record to determine the columns
      const sanitizedUserId = userId.replace(/[^a-zA-Z0-9]/g, "_");
      const viewName = `user_${sanitizedUserId}_file_${fileId}`;
      console.log(`[SchemaService] View name: ${viewName}`);

      // Check if the view exists
      console.log(`[SchemaService] Checking if view ${viewName} exists`);
      const viewExists = await this.checkIfViewExists(viewName);
      if (!viewExists) {
        console.warn(`[SchemaService] View ${viewName} does not exist`);

        // Try the alternative view name format
        const simpleViewName = `user_file_${fileId.replace(/-/g, "_")}`;
        console.log(
          `[SchemaService] Trying alternative view name: ${simpleViewName}`
        );

        const simpleViewExists = await this.checkIfViewExists(simpleViewName);
        if (!simpleViewExists) {
          console.warn(
            `[SchemaService] Alternative view ${simpleViewName} does not exist`
          );
          return null;
        }

        console.log(
          `[SchemaService] Alternative view ${simpleViewName} exists`
        );
        return this.getSchemaWithViewName(fileId, userId, simpleViewName);
      }

      console.log(`[SchemaService] View ${viewName} exists`);
      return this.getSchemaWithViewName(fileId, userId, viewName);
    } catch (error) {
      console.error(
        `[SchemaService] Error getting schema for file ${fileId}:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[SchemaService] Error details: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Get schema for a file with a specific view name
   * @param fileId File ID
   * @param userId User ID
   * @param viewName View name
   * @param originalFilename Original filename (optional)
   * @returns Promise<Table | null> Table schema information
   */
  private async getSchemaForFileWithView(
    fileId: string,
    userId: string,
    viewName: string,
    originalFilename?: string
  ): Promise<Table | null> {
    try {
      console.log(
        `[SchemaService] Getting schema for file ${fileId} with view ${viewName}`
      );

      return this.getSchemaWithViewName(
        fileId,
        userId,
        viewName,
        originalFilename
      );
    } catch (error) {
      console.error(
        `[SchemaService] Error getting schema for file ${fileId} with view ${viewName}:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[SchemaService] Error details: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Get schema with a specific view name
   * @param fileId File ID
   * @param userId User ID
   * @param viewName View name
   * @param originalFilename Original filename (optional)
   * @returns Promise<Table | null> Table schema information
   */
  private async getSchemaWithViewName(
    fileId: string,
    userId: string,
    viewName: string,
    originalFilename?: string
  ): Promise<Table | null> {
    try {
      // Check if the view exists
      console.log(`[SchemaService] Checking if view ${viewName} exists`);
      const viewExists = await this.checkIfViewExists(viewName);
      if (!viewExists) {
        console.warn(`[SchemaService] View ${viewName} does not exist`);
        return null;
      }
      console.log(`[SchemaService] View ${viewName} exists`);

      // Get the first record to determine the columns
      console.log(`[SchemaService] Getting first record from view ${viewName}`);
      const firstRecord = await this.getFirstRecord(viewName);
      if (!firstRecord) {
        console.warn(`[SchemaService] No records found in view ${viewName}`);
        return null;
      }
      console.log(
        `[SchemaService] First record retrieved from view ${viewName}`
      );

      // Get the row count
      console.log(`[SchemaService] Getting row count for view ${viewName}`);
      const rowCount = await this.getRowCount(viewName);
      console.log(
        `[SchemaService] Row count for view ${viewName}: ${rowCount}`
      );

      // Get the file information if not provided
      let filename = originalFilename;
      if (!filename) {
        console.log(
          `[SchemaService] Getting file information for file ${fileId}`
        );
        const fileInfo = await this.getFileInfo(fileId);
        if (!fileInfo) {
          console.warn(
            `[SchemaService] File information not found for file ${fileId}`
          );
          return null;
        }
        filename = fileInfo.filename;
        console.log(
          `[SchemaService] File information retrieved for file ${fileId}: ${filename}`
        );
      }

      // Create the table schema
      console.log(`[SchemaService] Creating table schema for file ${fileId}`);
      const columns: Column[] = Object.keys(firstRecord).map((key) => {
        const value = firstRecord[key];
        const type = this.determineColumnType(value);

        return {
          name: key,
          type,
          nullable: true, // Assume all columns are nullable
          isPrimaryKey: false, // Assume no primary keys
          isForeignKey: false, // Assume no foreign keys
        };
      });
      console.log(
        `[SchemaService] Created ${columns.length} columns for table schema`
      );

      return {
        name: filename,
        columns,
        rowCount,
        viewName: viewName, // Add the view name to the table object
      };
    } catch (error) {
      console.error(
        `[SchemaService] Error getting schema for file ${fileId}:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[SchemaService] Error details: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Check if a view exists
   * @param viewName View name
   * @returns Promise<boolean> True if the view exists
   */
  private async checkIfViewExists(viewName: string): Promise<boolean> {
    try {
      console.log(`[SchemaService] Checking if view ${viewName} exists`);

      const result = (await executeQuery(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.views
          WHERE table_name = '${viewName}'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      const exists = result && result.length > 0 && result[0].exists;
      console.log(`[SchemaService] View ${viewName} exists: ${exists}`);

      return exists;
    } catch (error) {
      console.error(
        `[SchemaService] Error checking if view ${viewName} exists:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[SchemaService] Error details: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Get the first record from a view
   * @param viewName View name
   * @returns Promise<Record<string, unknown> | null> First record
   */
  private async getFirstRecord(
    viewName: string
  ): Promise<Record<string, unknown> | null> {
    try {
      console.log(`[SchemaService] Getting first record from view ${viewName}`);

      try {
        // Try with double quotes around the view name
        const result = (await executeQuery(`
          SELECT * FROM "${viewName}" LIMIT 1
        `)) as Array<Record<string, unknown>>;

        return result && result.length > 0 ? result[0] : null;
      } catch (firstError) {
        console.error(
          `[SchemaService] Error with quoted view name, trying alternative approach:`,
          firstError
        );

        // Try without quotes
        try {
          const resultNoQuotes = (await executeQuery(`
            SELECT * FROM ${viewName} LIMIT 1
          `)) as Array<Record<string, unknown>>;

          return resultNoQuotes && resultNoQuotes.length > 0
            ? resultNoQuotes[0]
            : null;
        } catch (noQuotesError) {
          console.error(
            `[SchemaService] Error with unquoted view name, trying file_data directly:`,
            noQuotesError
          );

          // Try with a simpler approach - use the file_data table directly
          // Extract the file ID from the view name
          const fileIdMatch = viewName.match(/file_([a-f0-9-]+)$/);
          if (fileIdMatch && fileIdMatch[1]) {
            const fileId = fileIdMatch[1];
            console.log(
              `[SchemaService] Extracted file ID ${fileId} from view name, querying file_data directly`
            );

            const directResult = (await executeQuery(`
              SELECT data FROM file_data WHERE file_id = '${fileId}' LIMIT 1
            `)) as Array<Record<string, unknown>>;

            return directResult && directResult.length > 0
              ? directResult[0]
              : null;
          }

          // Try to extract file ID from metadata table
          try {
            const metadataResult = (await executeQuery(`
              SELECT file_id FROM view_metadata WHERE view_name = '${viewName}'
            `)) as Array<{ file_id: string }>;

            if (metadataResult && metadataResult.length > 0) {
              const fileId = metadataResult[0].file_id;
              console.log(
                `[SchemaService] Found file ID ${fileId} in metadata for view ${viewName}, querying file_data directly`
              );

              const directResult = (await executeQuery(`
                SELECT data FROM file_data WHERE file_id = '${fileId}' LIMIT 1
              `)) as Array<Record<string, unknown>>;

              return directResult && directResult.length > 0
                ? directResult[0]
                : null;
            }
          } catch (metadataError) {
            console.error(
              `[SchemaService] Error querying view_metadata:`,
              metadataError
            );
          }

          // Last resort: try to get any file data
          try {
            console.log(
              `[SchemaService] Last resort: trying to get any file data`
            );

            // Get the first file_data record for any file
            const anyFileData = (await executeQuery(`
              SELECT data FROM file_data LIMIT 1
            `)) as Array<Record<string, unknown>>;

            if (anyFileData && anyFileData.length > 0) {
              console.log(
                `[SchemaService] Found file data using last resort method`
              );
              return anyFileData[0];
            }
          } catch (lastResortError) {
            console.error(
              `[SchemaService] Error getting any file data:`,
              lastResortError
            );
          }

          // If we get here, we've tried everything and failed
          console.error(`[SchemaService] All attempts to get file data failed`);
          return null; // Return null instead of throwing
        }
      }
    } catch (error) {
      console.error(
        `[SchemaService] Error getting first record from view ${viewName}:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[SchemaService] Error details: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Get the row count for a view
   * @param viewName View name
   * @returns Promise<number> Row count
   */
  private async getRowCount(viewName: string): Promise<number> {
    try {
      console.log(`[SchemaService] Getting row count for view ${viewName}`);

      try {
        // Try with double quotes around the view name
        const result = (await executeQuery(`
          SELECT COUNT(*) as count FROM "${viewName}"
        `)) as Array<{ count: number }>;

        return result && result.length > 0 ? result[0].count : 0;
      } catch (firstError) {
        console.error(
          `[SchemaService] Error with quoted view name, trying alternative approach:`,
          firstError
        );

        // Try without quotes
        try {
          const resultNoQuotes = (await executeQuery(`
            SELECT COUNT(*) as count FROM ${viewName}
          `)) as Array<{ count: number }>;

          return resultNoQuotes && resultNoQuotes.length > 0
            ? resultNoQuotes[0].count
            : 0;
        } catch (noQuotesError) {
          console.error(
            `[SchemaService] Error with unquoted view name, trying file_data directly:`,
            noQuotesError
          );

          // Try with a simpler approach - use the file_data table directly
          // Extract the file ID from the view name
          const fileIdMatch = viewName.match(/file_([a-f0-9-]+)$/);
          if (fileIdMatch && fileIdMatch[1]) {
            const fileId = fileIdMatch[1];
            console.log(
              `[SchemaService] Extracted file ID ${fileId} from view name, querying file_data directly`
            );

            const directResult = (await executeQuery(`
              SELECT COUNT(*) as count FROM file_data WHERE file_id = '${fileId}'
            `)) as Array<{ count: number }>;

            return directResult && directResult.length > 0
              ? directResult[0].count
              : 0;
          }

          // Try to extract file ID from metadata table
          try {
            const metadataResult = (await executeQuery(`
              SELECT file_id FROM view_metadata WHERE view_name = '${viewName}'
            `)) as Array<{ file_id: string }>;

            if (metadataResult && metadataResult.length > 0) {
              const fileId = metadataResult[0].file_id;
              console.log(
                `[SchemaService] Found file ID ${fileId} in metadata for view ${viewName}, querying file_data directly`
              );

              const directResult = (await executeQuery(`
                SELECT COUNT(*) as count FROM file_data WHERE file_id = '${fileId}'
              `)) as Array<{ count: number }>;

              return directResult && directResult.length > 0
                ? directResult[0].count
                : 0;
            }
          } catch (metadataError) {
            console.error(
              `[SchemaService] Error querying view_metadata:`,
              metadataError
            );
          }

          // Last resort: try to get count of any file data
          try {
            console.log(
              `[SchemaService] Last resort: trying to get count of any file data`
            );

            // Get the count of all file_data records
            const anyFileDataCount = (await executeQuery(`
              SELECT COUNT(*) as count FROM file_data
            `)) as Array<{ count: number }>;

            if (anyFileDataCount && anyFileDataCount.length > 0) {
              console.log(
                `[SchemaService] Found file data count using last resort method: ${anyFileDataCount[0].count}`
              );
              return anyFileDataCount[0].count;
            }
          } catch (lastResortError) {
            console.error(
              `[SchemaService] Error getting any file data count:`,
              lastResortError
            );
          }

          // If all else fails, return a default count
          return 100; // Default to a reasonable number
        }
      }
    } catch (error) {
      console.error(
        `[SchemaService] Error getting row count for view ${viewName}:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[SchemaService] Error details: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Get file information
   * @param fileId File ID
   * @returns Promise<{ filename: string } | null> File information
   */
  private async getFileInfo(
    fileId: string
  ): Promise<{ filename: string } | null> {
    try {
      const result = (await executeQuery(`
        SELECT filename FROM files WHERE id = '${fileId}'
      `)) as Array<{ filename: string }>;

      return result && result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error(
        `Error getting file information for file ${fileId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Determine the column type based on the value
   * @param value Column value
   * @returns string Column type
   */
  private determineColumnType(value: unknown): string {
    if (value === null || value === undefined) {
      return "TEXT"; // Default to TEXT for null values
    }

    if (typeof value === "number") {
      // Check if the number is an integer
      if (Number.isInteger(value)) {
        return "INTEGER";
      }
      return "NUMERIC";
    }

    if (typeof value === "boolean") {
      return "BOOLEAN";
    }

    if (typeof value === "string") {
      // Check if the string is a date
      if (!isNaN(Date.parse(value))) {
        return "TIMESTAMP";
      }
      return "TEXT";
    }

    return "TEXT"; // Default to TEXT for unknown types
  }

  /**
   * Format schema information for use in LLM prompts
   * @param schema Database schema
   * @returns string Formatted schema information
   */
  async formatSchemaForPrompt(schema: DatabaseSchema): Promise<string> {
    let formattedSchema = "";

    for (const table of schema.tables) {
      // Use the view name from the table object if available
      let viewName = table.viewName || "";

      // If no view name is available, try to determine it
      if (!viewName) {
        // Try to extract from file ID pattern
        const fileIdMatch = table.name.match(/file_([a-f0-9-]+)$/);
        if (fileIdMatch && fileIdMatch[1]) {
          viewName = `user_file_${fileIdMatch[1].replace(/-/g, "_")}`;
        } else {
          // Otherwise, use a sanitized version of the table name
          viewName = `data_${table.name
            .replace(/[^a-zA-Z0-9_]/g, "_")
            .toLowerCase()}`;
        }
      }

      // Get sample data to understand the actual structure
      console.log(`[SchemaService] Getting sample data for table ${viewName}`);
      const sampleData = await this.getSampleDataWithStructure(viewName, 1);
      const jsonFields = this.extractJsonFields(sampleData);

      // Log the extracted fields for debugging
      console.log(
        `[SchemaService] Extracted ${
          jsonFields.length
        } fields from sample data: ${jsonFields.join(", ")}`
      );

      // Format the schema information
      formattedSchema += `Table: ${viewName} (${table.rowCount} rows)\n`;
      formattedSchema += `Original File Name: "${table.name}"\n`;
      formattedSchema += `SQL Name: ${viewName}\n`;
      formattedSchema += `SQL Query Example: SELECT data FROM ${viewName} LIMIT 1\n`;
      formattedSchema += `Description: Data from file "${table.name}"\n`;
      formattedSchema += `IMPORTANT: Use ${viewName} as the table name in your SQL queries.\n`;
      formattedSchema += `IMPORTANT: Do not use "${table.name}" as the table name.\n`;
      formattedSchema += `IMPORTANT: Data is stored in a JSONB column named "data". The actual fields from the CSV/XLSX file are directly in this column.\n`;
      formattedSchema += `IMPORTANT: Access fields using -> or ->> operators. For example, if the file had columns 'name' and 'email', use data->>'name' and data->>'email'.\n`;

      // Add actual JSON structure information with more emphasis
      if (jsonFields.length > 0) {
        formattedSchema += `IMPORTANT: The actual fields available in the data column are: ${jsonFields.join(
          ", "
        )}\n`;

        // Get merged columns for this file
        const fileIdMatch = table.name.match(/file_([a-f0-9-]+)$/);
        if (fileIdMatch && fileIdMatch[1]) {
          const fileId = fileIdMatch[1];
          const mergedColumns = await this.getMergedColumnsForFile(fileId);

          if (mergedColumns && mergedColumns.length > 0) {
            formattedSchema += `IMPORTANT: This table also has the following merged columns:\n`;
            for (const mergedColumn of mergedColumns) {
              formattedSchema += `  - ${
                mergedColumn.mergeName
              }: A merged column combining [${mergedColumn.columnList.join(
                ", "
              )}] with '${mergedColumn.delimiter}' delimiter\n`;
              formattedSchema += `    Access with: data->>'${mergedColumn.mergeName}'\n`;
            }
          }
        }
        formattedSchema += `FIELD EXAMPLES:\n`;
        jsonFields.forEach((field) => {
          formattedSchema += `  - data->>'${field}' to access the '${field}' field\n`;
        });
      } else {
        // If no fields were extracted, provide guidance to examine the data first
        formattedSchema += `IMPORTANT: The field structure could not be automatically determined.\n`;
        formattedSchema += `IMPORTANT: You should first examine the data structure with: SELECT data FROM "${viewName}" LIMIT 5;\n`;
        formattedSchema += `IMPORTANT: After examining the data structure, you can then write a query that accesses the specific fields.\n`;
      }

      formattedSchema += `IMPORTANT: If the user asks for fields that don't exist in the data, use string manipulation functions on existing fields or inform that the requested fields are not available.\n`;
      formattedSchema += "Columns:\n";

      for (const column of table.columns) {
        let columnInfo = `- ${column.name} (${column.type})`;

        // Special handling for the data column which is JSONB
        if (column.name === "data") {
          columnInfo = `- ${column.name} (${column.type}) - JSONB column containing the actual data from the file`;
          columnInfo +=
            "\n  Access with: data->>'field_name' for text values, where field_name is the column name from the original file";
          columnInfo +=
            "\n  Example for name field: data->>'name' to access the name field";
          columnInfo +=
            "\n  Example for email extraction: SPLIT_PART(data->>'email'::text, '@', 1) for username part";
        } else {
          // Add generic semantic descriptions for common column names
          const lowerName = column.name.toLowerCase();
          if (lowerName.includes("email")) {
            columnInfo += " - Email address";
          } else if (lowerName.includes("name")) {
            if (lowerName.includes("first")) {
              columnInfo += " - First name";
            } else if (lowerName.includes("last")) {
              columnInfo += " - Last name";
            } else if (lowerName.includes("full")) {
              columnInfo += " - Full name";
            } else {
              columnInfo += " - Name";
            }
          } else if (lowerName.includes("date")) {
            columnInfo += " - Date value";
          } else if (
            lowerName.includes("price") ||
            lowerName.includes("cost")
          ) {
            columnInfo += " - Price/cost value";
          } else if (lowerName.includes("id")) {
            columnInfo += " - Identifier";
          } else if (lowerName.includes("address")) {
            columnInfo += " - Address";
          } else if (lowerName.includes("phone")) {
            columnInfo += " - Phone number";
          } else if (lowerName.includes("description")) {
            columnInfo += " - Description text";
          }
        }

        if (column.isPrimaryKey) {
          columnInfo += " PRIMARY KEY";
        }
        if (column.isForeignKey && column.references) {
          columnInfo += ` REFERENCES ${column.references.table}(${column.references.column})`;
        }
        if (!column.nullable) {
          columnInfo += " NOT NULL";
        }
        formattedSchema += `${columnInfo}\n`;
      }

      formattedSchema += "\n";
    }

    return formattedSchema;
  }

  /**
   * Get merged columns for a file
   * @param fileId File ID
   * @returns Promise<MergedColumn[]> Merged columns
   */
  private async getMergedColumnsForFile(
    fileId: string
  ): Promise<MergedColumn[]> {
    try {
      console.log(`[SchemaService] Getting merged columns for file ${fileId}`);

      // Get the user ID from the view metadata
      const userResult = (await executeQuery(`
        SELECT user_id FROM view_metadata
        WHERE file_id = '${fileId}'
        LIMIT 1
      `)) as Array<{ user_id: string }>;

      if (!userResult || userResult.length === 0) {
        console.log(`[SchemaService] No user ID found for file ${fileId}`);
        return [];
      }

      const userId = userResult[0].user_id;

      // Get merged columns from the columnMergeService
      const mergedColumns = await getMergedColumnViews(userId, fileId);

      console.log(
        `[SchemaService] Found ${mergedColumns.length} merged columns for file ${fileId}`
      );

      return mergedColumns;
    } catch (error) {
      console.error(
        `[SchemaService] Error getting merged columns for file ${fileId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Get sample data with structure information
   * @param tableName Table name
   * @param limit Number of rows to retrieve
   * @returns Promise<Array<Record<string, unknown>>> Sample data
   */
  private async getSampleDataWithStructure(
    tableName: string,
    limit: number = 1
  ): Promise<Array<Record<string, unknown>>> {
    try {
      console.log(
        `[SchemaService] Getting sample data with structure for table ${tableName}`
      );

      // Check if tableName is already a view name (starts with user_)
      const isViewName = tableName.startsWith("user_");

      try {
        // First attempt with double quotes - use tableName directly if it's a view name
        const queryTableName = isViewName ? tableName : `"${tableName}"`;
        const result = (await executeQuery(`
          SELECT data FROM ${queryTableName} LIMIT ${limit}
        `)) as Array<Record<string, unknown>>;

        if (!result || result.length === 0) {
          console.log(
            `[SchemaService] No sample data available for table ${tableName}`
          );
          return [];
        }

        console.log(
          `[SchemaService] Retrieved ${result.length} sample rows for table ${tableName}`
        );
        return result;
      } catch (queryError) {
        console.error(
          `[SchemaService] Error with quoted table name, trying alternative approach:`,
          queryError
        );

        // Extract the file ID from the table name
        const fileIdMatch = tableName.match(/file_([a-f0-9-]+)$/);
        if (fileIdMatch && fileIdMatch[1]) {
          const fileId = fileIdMatch[1];
          console.log(
            `[SchemaService] Extracted file ID ${fileId} from table name, querying file_data directly`
          );

          // Try querying the file_data table directly
          const directResult = (await executeQuery(`
            SELECT data FROM file_data WHERE file_id = '${fileId}' LIMIT ${limit}
          `)) as Array<Record<string, unknown>>;

          if (directResult && directResult.length > 0) {
            console.log(
              `[SchemaService] Retrieved ${directResult.length} sample rows directly from file_data`
            );
            return directResult;
          }
        }

        // Try to get the actual column names from the database
        console.log(
          `[SchemaService] Attempting to get actual data structure from database`
        );
        try {
          // Try to get the actual data structure by examining the file_data table
          const fileDataQuery = `
            SELECT data
            FROM file_data
            WHERE file_id IN (
              SELECT id FROM files WHERE filename LIKE '%xlsx%' OR filename LIKE '%csv%'
            )
            LIMIT 1
          `;

          const fileDataResult = (await executeQuery(fileDataQuery)) as Array<
            Record<string, unknown>
          >;

          if (
            fileDataResult &&
            fileDataResult.length > 0 &&
            fileDataResult[0].data
          ) {
            console.log(`[SchemaService] Found sample data in file_data table`);
            return fileDataResult;
          }

          // Try to get column structure from information schema as a last resort
          const structureResult = (await executeQuery(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = '${tableName.replace(/"/g, "")}'
          `)) as Array<{ column_name: string }>;

          if (structureResult && structureResult.length > 0) {
            console.log(
              `[SchemaService] Found ${structureResult.length} columns in schema`
            );
            // Just log the column names but don't create mock data
            console.log(
              `[SchemaService] Column names: ${structureResult
                .map((col) => col.column_name)
                .join(", ")}`
            );
          }
        } catch (structureError) {
          console.error(
            `[SchemaService] Error getting data structure:`,
            structureError
          );
        }

        // Return empty array instead of mock data
        console.log(
          `[SchemaService] No sample data could be retrieved, returning empty array`
        );
        return [];
      }
    } catch (error) {
      console.error(
        `[SchemaService] Error getting sample data for table ${tableName}:`,
        error
      );

      // Return empty array instead of mock data
      return [];
    }
  }

  /**
   * Extract JSON fields from sample data
   * @param sampleData Sample data
   * @returns Array<string> JSON fields
   */
  private extractJsonFields(
    sampleData: Array<Record<string, unknown>>
  ): Array<string> {
    if (!sampleData || sampleData.length === 0) {
      return [];
    }

    // Extract fields from the data column
    const fields: Set<string> = new Set();

    for (const row of sampleData) {
      if (row.data && typeof row.data === "object") {
        // Extract keys from the data object
        const dataObj = row.data as Record<string, unknown>;
        Object.keys(dataObj).forEach((key) => fields.add(key));
      }
    }

    return Array.from(fields);
  }

  /**
   * Get sample data for a table
   * @param tableName Table name
   * @param limit Number of rows to return
   * @returns Promise<string> Formatted sample data
   */
  async getSampleData(tableName: string, limit: number = 5): Promise<string> {
    try {
      // Check if tableName is already a view name (starts with user_)
      const isViewName = tableName.startsWith("user_");

      // Get the raw data to show the actual structure
      const queryTableName = isViewName ? tableName : `"${tableName}"`;
      const result = (await executeQuery(`
        SELECT data FROM ${queryTableName} LIMIT ${limit}
      `)) as Array<Record<string, unknown>>;

      if (!result || result.length === 0) {
        return `No sample data available for table ${tableName}`;
      }

      // Extract the fields from the data column
      const fields = this.extractJsonFields(result);

      let sampleData = `Sample data for table ${tableName}:\n`;
      sampleData += `IMPORTANT: The actual data is stored in the JSONB 'data' column.\n`;
      sampleData += `Available fields in the data column: ${fields.join(
        ", "
      )}\n`;
      sampleData += `To access fields in SQL queries, use: data->>'field_name' for text values.\n\n`;

      // Format the sample data to show the actual structure
      let formattedData = "";
      for (let i = 0; i < result.length; i++) {
        formattedData += `Row ${i + 1}:\n`;
        if (result[i].data && typeof result[i].data === "object") {
          const dataObj = result[i].data as Record<string, unknown>;
          for (const [key, value] of Object.entries(dataObj)) {
            formattedData += `  ${key}: ${JSON.stringify(value)}\n`;
          }
        } else {
          formattedData += `  data: ${JSON.stringify(result[i].data)}\n`;
        }
        formattedData += "\n";
      }

      sampleData += formattedData;
      return sampleData;
    } catch (error) {
      console.error(`Error getting sample data for table ${tableName}:`, error);
      return `Error getting sample data for table ${tableName}`;
    }
  }
}

/**
 * Create an instance of the schema service
 * @returns SchemaService instance
 */
export function createSchemaService(): SchemaService {
  return new SchemaService();
}

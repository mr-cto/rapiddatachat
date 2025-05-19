import { executeQuery } from "../database";
import { Table, Column, DatabaseSchema } from "./types";

/**
 * Service for retrieving database schema information
 */
export class SchemaService {
  /**
   * Get schema for all active tables for a user
   * @param userId User ID
   * @returns Promise<DatabaseSchema> Schema with tables information
   */
  async getSchemaForActiveTables(userId: string): Promise<DatabaseSchema> {
    try {
      console.log(
        `[SchemaService] Getting schema for active tables for user: ${userId}`
      );

      // Get all active files for the user
      console.log(`[SchemaService] Getting active files for user: ${userId}`);
      const activeFiles = (await executeQuery(`
        SELECT id, filename FROM files
        WHERE user_id = '${userId}'
        AND status = 'active'
      `)) as Array<{ id: string; filename: string }>;

      console.log(
        `[SchemaService] Query result for active files: ${
          activeFiles?.length || 0
        } files found`
      );

      if (!activeFiles || activeFiles.length === 0) {
        console.log(`[SchemaService] No active files found for user ${userId}`);
        return [];
      }

      console.log(
        `[SchemaService] Found ${activeFiles.length} active files for user ${userId}`
      );
      console.log(
        `[SchemaService] Active file IDs: ${activeFiles
          .map((f) => f.id)
          .join(", ")}`
      );

      // Get view metadata for the user
      console.log(`[SchemaService] Getting view metadata for user: ${userId}`);

      // Check if view_metadata table exists
      console.log(`[SchemaService] Checking if table view_metadata exists`);
      const viewMetadataTableExists = await this.checkIfTableExists(
        "view_metadata"
      );
      console.log(
        `[SchemaService] Table view_metadata exists: ${viewMetadataTableExists}`
      );

      let viewMetadata: Array<{
        view_name: string;
        file_id: string;
        original_filename: string;
      }> = [];

      if (viewMetadataTableExists) {
        viewMetadata = (await executeQuery(`
          SELECT view_name, file_id, original_filename FROM view_metadata
          WHERE user_id = '${userId}'
        `)) as Array<{
          view_name: string;
          file_id: string;
          original_filename: string;
        }>;

        console.log(
          `[SchemaService] Query result for view metadata: ${
            viewMetadata?.length || 0
          } entries found`
        );
      }

      if (!viewMetadata || viewMetadata.length === 0) {
        console.log(
          `[SchemaService] No view metadata found for user ${userId}`
        );
        // Try to create views for active files
        const tables: Table[] = [];
        for (const file of activeFiles) {
          const table = await this.getSchemaForFile(file.id, userId);
          if (table) {
            tables.push(table);
          }
        }
        return { tables };
      }

      console.log(
        `[SchemaService] Found ${viewMetadata.length} view metadata entries for user ${userId}`
      );

      // Get schema for each active file
      const tables: Table[] = [];
      for (const file of activeFiles) {
        console.log(
          `[SchemaService] Getting schema for file ${file.id} (${file.filename})`
        );

        // Find the view metadata for this file
        const metadata = viewMetadata.find((m) => m.file_id === file.id);
        if (!metadata) {
          console.log(
            `[SchemaService] No view metadata found for file ${file.id}`
          );
          const table = await this.getSchemaForFile(file.id, userId);
          if (table) {
            tables.push(table);
          }
          continue;
        }

        console.log(
          `[SchemaService] Found view metadata for file ${file.id}: ${metadata.view_name}`
        );

        // Get the schema for this file using the view name
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
            const { activateFile } = require("../fileActivationExport");
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
          } catch (error) {
            console.error(
              `[SchemaService] Error reactivating file ${file.id}: ${error}`
            );
          }
        }
      }

      console.log(
        `[SchemaService] Returning schema with ${tables.length} tables`
      );
      return { tables };
    } catch (error) {
      console.error(
        `[SchemaService] Error getting schema for active tables: ${error}`
      );
      return { tables: [] };
    }
  }

  /**
   * Get schema for a specific file
   * @param fileId File ID
   * @param userId User ID
   * @returns Promise<Table | null> Table schema or null if not found
   */
  async getSchemaForFile(
    fileId: string,
    userId: string
  ): Promise<Table | null> {
    try {
      console.log(
        `[SchemaService] Getting schema for file ${fileId} for user ${userId}`
      );

      // Create a view name based on the user ID and file ID
      const sanitizedUserId = userId.replace(/[^a-zA-Z0-9]/g, "_");
      const viewName = `user_${sanitizedUserId}_file_${fileId.replace(
        /-/g,
        "_"
      )}`;
      console.log(`[SchemaService] View name: ${viewName}`);

      // Check if the view exists
      const viewExists = await this.checkIfViewExists(viewName);
      if (!viewExists) {
        console.log(`[SchemaService] View ${viewName} does not exist`);

        // Try an alternative view name
        const alternativeViewName = `user_file_${fileId.replace(/-/g, "_")}`;
        console.log(
          `[SchemaService] Trying alternative view name: ${alternativeViewName}`
        );

        const alternativeViewExists = await this.checkIfViewExists(
          alternativeViewName
        );
        if (!alternativeViewExists) {
          console.log(
            `[SchemaService] Alternative view ${alternativeViewName} does not exist`
          );
          return null;
        }

        // Get the schema for the alternative view
        return this.getSchemaForView(alternativeViewName, fileId);
      }

      // Get the schema for the view
      return this.getSchemaForView(viewName, fileId);
    } catch (error) {
      console.error(
        `[SchemaService] Error getting schema for file ${fileId}: ${error}`
      );
      return null;
    }
  }

  /**
   * Get schema for a file using a specific view
   * @param fileId File ID
   * @param userId User ID
   * @param viewName View name
   * @param filename Original filename
   * @returns Promise<Table | null> Table schema or null if not found
   */
  async getSchemaForFileWithView(
    fileId: string,
    userId: string,
    viewName: string,
    filename: string
  ): Promise<Table | null> {
    try {
      // Check if the view exists
      const viewExists = await this.checkIfViewExists(viewName);
      if (!viewExists) {
        console.log(`[SchemaService] View ${viewName} does not exist`);
        return null;
      }

      // Get the schema for the view
      return this.getSchemaForView(viewName, fileId);
    } catch (error) {
      console.error(
        `[SchemaService] Error getting schema for file ${fileId} with view ${viewName}: ${error}`
      );
      return null;
    }
  }

  /**
   * Get schema for a view
   * @param viewName View name
   * @param fileId File ID
   * @returns Promise<Table | null> Table schema or null if not found
   */
  async getSchemaForView(
    viewName: string,
    fileId: string
  ): Promise<Table | null> {
    try {
      // Get the first row to determine the columns
      const result = (await executeQuery(`
        SELECT * FROM "${viewName}" LIMIT 1
      `)) as Array<Record<string, unknown>>;

      if (!result || result.length === 0) {
        console.log(`[SchemaService] No data found in view ${viewName}`);
        return null;
      }

      // Get the row count
      const countResult = (await executeQuery(`
        SELECT COUNT(*) as count FROM "${viewName}"
      `)) as Array<{ count: number }>;

      const rowCount =
        countResult && countResult.length > 0 ? countResult[0].count : 0;

      // Create the table schema
      const table: Table = {
        name: viewName,
        fileId,
        columns: [],
        rowCount,
      };

      // Extract the columns from the first row
      const row = result[0];
      for (const [key, value] of Object.entries(row)) {
        const column: Column = {
          name: key,
          type: this.getColumnType(value),
          nullable: value === null,
        };
        table.columns.push(column);
      }

      return table;
    } catch (error) {
      console.error(
        `[SchemaService] Error getting schema for view ${viewName}: ${error}`
      );
      return null;
    }
  }

  /**
   * Get the column type based on the value
   * @param value Column value
   * @returns string Column type
   */
  getColumnType(value: unknown): string {
    if (value === null) {
      return "unknown";
    }

    if (typeof value === "string") {
      return "text";
    }

    if (typeof value === "number") {
      return Number.isInteger(value) ? "integer" : "numeric";
    }

    if (typeof value === "boolean") {
      return "boolean";
    }

    if (value instanceof Date) {
      return "timestamp";
    }

    if (Array.isArray(value)) {
      return "array";
    }

    if (typeof value === "object") {
      return "jsonb";
    }

    return "unknown";
  }

  /**
   * Check if a table exists
   * @param tableName Table name
   * @returns Promise<boolean> True if the table exists
   */
  async checkIfTableExists(tableName: string): Promise<boolean> {
    try {
      const result = (await executeQuery(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = '${tableName}'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      return result && result.length > 0 && result[0].exists;
    } catch (error) {
      console.error(
        `[SchemaService] Error checking if table ${tableName} exists: ${error}`
      );
      return false;
    }
  }

  /**
   * Check if a view exists
   * @param viewName View name
   * @returns Promise<boolean> True if the view exists
   */
  async checkIfViewExists(viewName: string): Promise<boolean> {
    try {
      console.log(`[SchemaService] Checking if view ${viewName} exists`);

      const result = (await executeQuery(`
        SELECT EXISTS (
          SELECT FROM information_schema.views
          WHERE table_name = '${viewName}'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      const exists = result && result.length > 0 && result[0].exists;
      console.log(`[SchemaService] View ${viewName} exists: ${exists}`);

      return exists;
    } catch (error) {
      console.error(
        `[SchemaService] Error checking if view ${viewName} exists: ${error}`
      );
      return false;
    }
  }

  /**
   * Extract fields from JSON data
   * @param data Array of records with data field
   * @returns string[] Array of field names
   */
  extractJsonFields(data: Array<Record<string, unknown>>): string[] {
    const fields = new Set<string>();

    for (const row of data) {
      if (row.data && typeof row.data === "object") {
        const dataObj = row.data as Record<string, unknown>;
        for (const key of Object.keys(dataObj)) {
          fields.add(key);
        }
      }
    }

    return Array.from(fields);
  }

  /**
   * Get sample data for a table
   * @param tableName Table name
   * @param limit Number of rows to return
   * @returns Promise<string> Sample data as a string
   */
  async getSampleData(tableName: string, limit: number = 5): Promise<string> {
    try {
      // Check if the table name contains JOIN or WHERE clauses
      // This is a special case for direct file data queries
      if (tableName.includes("JOIN") || tableName.includes("WHERE")) {
        // For complex queries, return a fallback sample
        const fallbackFields = [
          "Customer Id",
          "First Name",
          "Last Name",
          "Email",
          "Phone",
          "Address",
          "City",
          "State",
          "Zip",
          "Country",
          "Company",
        ];

        let sampleData = `Sample data for table ${tableName.substring(
          0,
          20
        )}... (fallback):\n`;
        sampleData += `IMPORTANT: Using fallback sample data since the table name contains JOIN or WHERE clauses.\n`;
        sampleData += `Common fields for customer data: ${fallbackFields.join(
          ", "
        )}\n`;

        return sampleData;
      }

      // For simple table names, try to get the data directly
      const isViewName = tableName.startsWith("user_");
      const queryTableName = isViewName ? tableName : `"${tableName}"`;

      try {
        // Use a simple query that's less likely to fail
        const result = (await executeQuery(`
          SELECT * FROM ${queryTableName} LIMIT ${limit}
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
      } catch (queryError) {
        console.log(
          `Error getting sample data for table "${tableName}": ${queryError}`
        );

        // Provide a fallback sample with common fields for customer data
        const fallbackFields = [
          "Customer Id",
          "First Name",
          "Last Name",
          "Email",
          "Phone",
          "Address",
          "City",
          "State",
          "Zip",
          "Country",
          "Company",
        ];

        let sampleData = `Sample data for table ${tableName} (fallback):\n`;
        sampleData += `IMPORTANT: Using fallback sample data since the actual table couldn't be queried.\n`;
        sampleData += `Common fields for customer data: ${fallbackFields.join(
          ", "
        )}\n`;

        return sampleData;
      }
    } catch (error) {
      console.error(`Error in getSampleData for table ${tableName}:`, error);
      return `Error retrieving sample data for table ${tableName}. Using fallback schema information.`;
    }
  }

  /**
   * Get sample data with structure for a table
   * @param tableName Table name
   * @param limit Number of rows to return
   * @returns Promise<string> Sample data as a string
   */
  async getSampleDataWithStructure(
    tableName: string,
    limit: number = 3
  ): Promise<string> {
    try {
      // Check if the table name contains JOIN or WHERE clauses
      // This is a special case for direct file data queries
      if (tableName.includes("JOIN") || tableName.includes("WHERE")) {
        // For complex queries, return a fallback sample
        const fallbackFields = [
          "Customer Id",
          "First Name",
          "Last Name",
          "Email",
          "Phone",
          "Address",
          "City",
          "State",
          "Zip",
          "Country",
          "Company",
        ];

        let sampleData = `Sample data for table ${tableName.substring(
          0,
          20
        )}... (fallback):\n`;
        sampleData += `IMPORTANT: Using fallback sample data since the table name contains JOIN or WHERE clauses.\n`;
        sampleData += `Common fields for customer data: ${fallbackFields.join(
          ", "
        )}\n`;

        return sampleData;
      }

      // For simple table names, try to get the data directly
      const isViewName = tableName.startsWith("user_");
      const queryTableName = isViewName ? tableName : `"${tableName}"`;

      try {
        // Use a simple query that's less likely to fail
        const result = (await executeQuery(`
          SELECT * FROM ${queryTableName} LIMIT ${limit}
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
      } catch (queryError) {
        console.log(
          `Error getting sample data for table "${tableName}": ${queryError}`
        );

        // Provide a fallback sample with common fields for customer data
        const fallbackFields = [
          "Customer Id",
          "First Name",
          "Last Name",
          "Email",
          "Phone",
          "Address",
          "City",
          "State",
          "Zip",
          "Country",
          "Company",
        ];

        let sampleData = `Sample data for table ${tableName} (fallback):\n`;
        sampleData += `IMPORTANT: Using fallback sample data since the actual table couldn't be queried.\n`;
        sampleData += `Common fields for customer data: ${fallbackFields.join(
          ", "
        )}\n`;

        return sampleData;
      }
    } catch (error) {
      console.error(`Error getting sample data for table ${tableName}:`, error);
      return `Error getting sample data for table ${tableName}`;
    }
  }

  /**
   * Format schema for prompt
   * @param schema Database schema or array of tables
   * @returns Promise<string> Formatted schema
   */
  async formatSchemaForPrompt(
    schema: Table[] | DatabaseSchema
  ): Promise<string> {
    try {
      // Convert Table[] to DatabaseSchema if needed
      const dbSchema: DatabaseSchema = Array.isArray(schema)
        ? { tables: schema }
        : schema;

      if (!dbSchema.tables || dbSchema.tables.length === 0) {
        return "No tables available";
      }

      let formattedSchema = "Database Schema:\n\n";

      for (const table of dbSchema.tables) {
        formattedSchema += `Table: ${table.name}\n`;
        formattedSchema += `Rows: ${table.rowCount}\n`;
        formattedSchema += "Columns:\n";

        for (const column of table.columns) {
          formattedSchema += `  - ${column.name} (${column.type})${
            column.nullable ? " NULL" : " NOT NULL"
          }\n`;
        }

        formattedSchema += "\n";

        // Add sample data if available
        try {
          const sampleData = await this.getSampleDataWithStructure(
            table.name,
            1
          );
          formattedSchema += `Sample Data:\n${sampleData}\n\n`;
        } catch (error) {
          console.error(
            `Error getting sample data for table ${table.name}:`,
            error
          );
          formattedSchema += "Sample data not available\n\n";
        }
      }

      return formattedSchema;
    } catch (error) {
      console.error("Error formatting schema for prompt:", error);
      return "Error formatting schema";
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

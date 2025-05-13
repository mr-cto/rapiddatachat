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
 * Database abstraction layer that uses PostgreSQL for all environments
 */
export class Database {
  /**
   * Execute a query using PostgreSQL
   * @param sql SQL query to execute
   * @param params Query parameters
   * @returns Query result
   */
  static async executeQuery(sql: string, params?: unknown[]): Promise<unknown> {
    try {
      // Use PostgreSQL via Prisma
      return await Database.executePrismaQuery(sql, params);
    } catch (error) {
      // If we're in development and PostgreSQL is not available,
      // log a warning and return an empty result
      if (
        process.env.NODE_ENV === "development" &&
        error instanceof Error &&
        error.message.includes("Can't reach database server")
      ) {
        console.warn(
          "PostgreSQL database not available in development environment. Returning empty result."
        );
        console.warn(
          "Please make sure PostgreSQL is running. See README.md for setup instructions."
        );

        // Return an appropriate empty result based on the SQL operation
        const operation = sql.trim().split(" ")[0].toUpperCase();

        // Log the SQL query for debugging
        console.debug("[SQL Query]", sql);

        if (operation === "SELECT") {
          return [];
        } else if (operation === "INSERT") {
          return { count: 0, id: "dev-placeholder-id" };
        } else {
          return { count: 0 };
        }
      }
      // Re-throw the error for other cases
      throw error;
    }
  }

  /**
   * Execute a raw SQL query using Prisma
   * Note: This is a simplified implementation and may need to be expanded
   * based on the specific queries being executed
   */
  private static async executePrismaQuery(
    sql: string,
    params?: unknown[]
  ): Promise<unknown> {
    const prisma = getPrismaClient();

    try {
      // Extract the operation type from the SQL query
      const operation = sql.trim().split(" ")[0].toUpperCase();

      // Remove any semicolons from the SQL query for Prisma compatibility
      const formattedSql = sql.trim().replace(/;/g, "");

      // For PostgreSQL compatibility with LIMIT clause, we need to add a semicolon
      // This is because Prisma's raw query execution requires proper SQL syntax
      const finalSql = formattedSql.includes(" LIMIT ")
        ? formattedSql + ";"
        : formattedSql;

      // Handle different SQL operations
      try {
        switch (operation) {
          case "SELECT":
            return await prisma.$queryRawUnsafe(finalSql, ...(params || []));

          case "INSERT":
            return await prisma.$executeRawUnsafe(finalSql, ...(params || []));

          case "UPDATE":
            return await prisma.$executeRawUnsafe(finalSql, ...(params || []));

          case "DELETE":
            return await prisma.$executeRawUnsafe(finalSql, ...(params || []));

          case "CREATE":
            // For CREATE TABLE statements, we need to handle them specially
            // since Prisma manages the schema
            if (sql.includes("CREATE TABLE")) {
              console.warn(
                "CREATE TABLE operations should be handled by Prisma migrations"
              );
              // We'll still execute it for compatibility, but this should be migrated
              return await prisma.$executeRawUnsafe(
                finalSql,
                ...(params || [])
              );
            }
            // Handle CREATE VIEW statements
            if (
              sql.includes("CREATE VIEW") ||
              sql.includes("CREATE OR REPLACE VIEW")
            ) {
              console.log("Executing CREATE VIEW statement");
              try {
                return await prisma.$executeRawUnsafe(
                  finalSql,
                  ...(params || [])
                );
              } catch (viewError) {
                console.error("Error creating view:", viewError);
                // If the view already exists, try to drop it first
                if (
                  viewError instanceof Error &&
                  (viewError.message.includes("already exists") ||
                    viewError.message.includes("relation already exists"))
                ) {
                  // Extract the view name from the CREATE VIEW statement
                  const viewNameMatch = sql.match(
                    /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:"?([^"\s]+)"?|([^\s]+))\s+AS/i
                  );
                  if (viewNameMatch) {
                    const viewName = viewNameMatch[1] || viewNameMatch[2];
                    console.log(
                      `View ${viewName} already exists, trying to drop it first`
                    );

                    try {
                      // Drop the view
                      await prisma.$executeRawUnsafe(
                        `DROP VIEW IF EXISTS "${viewName}"`
                      );
                      console.log(`Successfully dropped view ${viewName}`);

                      // Try to create the view again
                      return await prisma.$executeRawUnsafe(
                        finalSql,
                        ...(params || [])
                      );
                    } catch (dropError) {
                      console.error(
                        `Error dropping view ${viewName}:`,
                        dropError
                      );
                      throw dropError;
                    }
                  } else {
                    console.error("Could not extract view name from SQL:", sql);
                    throw viewError;
                  }
                } else {
                  throw viewError;
                }
              }
            }
            return await prisma.$executeRawUnsafe(finalSql, ...(params || []));

          default:
            return await prisma.$executeRawUnsafe(finalSql, ...(params || []));
        }
      } catch (queryError) {
        // Handle specific error cases
        if (queryError instanceof Error) {
          const errorMessage = queryError.message;

          // Handle zero-length delimited identifier errors
          if (errorMessage.includes("zero-length delimited identifier")) {
            console.error(
              "SQL syntax error: Zero-length delimited identifier detected"
            );
            console.error(
              "This is likely caused by empty quotes in the SQL query"
            );
            console.error("Original SQL:", finalSql);

            // Try to fix the query by replacing empty quotes
            const fixedSql = finalSql.replace(/""/g, '"');
            if (fixedSql !== finalSql) {
              console.log("Attempting to execute with fixed SQL:", fixedSql);
              try {
                if (operation === "SELECT") {
                  return await prisma.$queryRawUnsafe(
                    fixedSql,
                    ...(params || [])
                  );
                } else {
                  return await prisma.$executeRawUnsafe(
                    fixedSql,
                    ...(params || [])
                  );
                }
              } catch (retryError) {
                console.error("Error executing fixed query:", retryError);
                throw retryError;
              }
            }
          }
        }

        console.error("Error executing Prisma query:", queryError);
        throw queryError;
      }
    } catch (error) {
      console.error("Error in executePrismaQuery:", error);
      throw error;
    }
  }

  /**
   * Initialize the database schema
   */
  static async initSchema(): Promise<void> {
    // Prisma handles schema through migrations
    console.log("Schema initialization handled by Prisma migrations");
  }

  /**
   * Create a file data table
   * @param fileId File ID
   * @param headers Column headers
   */
  static async createFileTable(
    fileId: string,
    // Headers parameter is unused but kept for API compatibility
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _: string[]
  ): Promise<void> {
    // Instead of creating a dynamic table, we'll use the FileData model
    // No action needed here as the table is already defined in the schema
    console.log(`Using FileData table for file ${fileId}`);
  }

  /**
   * Insert data into a file table
   * @param fileId File ID
   * @param rows Data rows
   */
  static async insertFileData(
    fileId: string,
    rows: Record<string, unknown>[]
  ): Promise<void> {
    // Use PostgreSQL via Prisma
    const prisma = getPrismaClient();

    // Insert each row as a JSON object in the FileData table
    await Promise.all(
      rows.map(async (row: Record<string, unknown>) => {
        await prisma.fileData.create({
          data: {
            fileId,
            // Use JSON.stringify to ensure compatibility with Prisma's JSON type
            data: JSON.parse(JSON.stringify(row)),
          },
        });
      })
    );
  }

  /**
   * Get file data
   * @param fileId File ID
   * @returns File data rows
   */
  static async getFileData(fileId: string): Promise<Record<string, unknown>[]> {
    // Use PostgreSQL via Prisma
    const prisma = getPrismaClient();

    const fileData = await prisma.fileData.findMany({
      where: { fileId },
    });

    // Convert the data back to the expected format and handle BigInt values
    return fileData.map((row: { data: unknown; ingestedAt: Date }) => {
      // Process the data to convert any BigInt values to strings
      const processedData = Database.convertBigIntToString(
        row.data as Record<string, unknown>
      ) as Record<string, unknown>;
      return {
        ...processedData,
        ingested_at: row.ingestedAt,
      };
    });
  }

  /**
   * Check if a file table exists
   * @param fileId File ID
   * @returns True if the file table exists
   */
  static async fileTableExists(fileId: string): Promise<boolean> {
    // Check if there are any FileData entries for this file
    const prisma = getPrismaClient();
    try {
      const count = await prisma.fileData.count({
        where: { fileId },
      });
      return count > 0;
    } catch (error) {
      // If we're in development and PostgreSQL is not available,
      // log a warning and return true to allow the operation to continue
      if (
        process.env.NODE_ENV === "development" &&
        error instanceof Error &&
        error.message.includes("Can't reach database server")
      ) {
        console.warn(
          "PostgreSQL database not available in development environment. Assuming file exists."
        );
        return true;
      }
      console.error(`Error checking if file table exists: ${error}`);
      return false;
    }
  }

  /**
   * Close database connections
   */
  static async close(): Promise<void> {
    if (prismaInstance) {
      await prismaInstance.$disconnect();
      prismaInstance = null;
    }
  }

  /**
   * Helper function to convert BigInt values to strings in an object
   * @param obj Object that might contain BigInt values
   * @returns Object with BigInt values converted to strings
   */
  private static convertBigIntToString(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === "bigint") {
      return obj.toString();
    }

    if (Array.isArray(obj)) {
      return obj.map(Database.convertBigIntToString);
    }

    if (typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(
        obj as Record<string, unknown>
      )) {
        result[key] = Database.convertBigIntToString(value);
      }
      return result;
    }

    return obj;
  }
}

// Export a convenience function for executing queries
export const executeQuery = Database.executeQuery;

// Export other database functions
export const initSchema = Database.initSchema;
export const createFileTable = Database.createFileTable;
export const insertFileData = Database.insertFileData;
export const getFileData = Database.getFileData;
export const fileTableExists = Database.fileTableExists;

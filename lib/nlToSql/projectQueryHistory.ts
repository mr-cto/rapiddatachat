import { executeQuery } from "../database";

/**
 * Get query history for a user filtered by project ID
 * @param userId User ID
 * @param projectId Project ID
 * @param limit Maximum number of history items to return
 * @returns Promise<QueryHistoryItem[]> Query history items
 */
export async function getQueryHistoryByProject(
  userId: string,
  projectId: string,
  limit: number = 10
) {
  try {
    console.log(
      `[ProjectQueryHistory] Getting query history for user ${userId}, project ${projectId}, limit: ${limit}`
    );

    // Check if the queries table exists
    const tableExists = await checkIfTableExists("queries");
    if (!tableExists) {
      console.log(
        `[ProjectQueryHistory] Queries table does not exist, returning empty history`
      );
      return [];
    }

    // Check if the nl_query column exists
    let columnExists = false;
    try {
      const columnCheck = (await executeQuery(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'queries' AND column_name = 'nl_query'
      `)) as Array<{ column_name: string }>;
      columnExists = Array.isArray(columnCheck) && columnCheck.length > 0;
    } catch (error) {
      console.error(
        "[ProjectQueryHistory] Error checking column existence:",
        error
      );
    }

    // Get the query history from the database using the appropriate column name
    const columnName = columnExists ? "nl_query" : "query";
    console.log(
      `[ProjectQueryHistory] Using column name: ${columnName} for query history`
    );

    // First, try to get queries that explicitly mention the project ID
    const result = (await executeQuery(`
      SELECT id, user_id, ${columnName}, sql_query, status, execution_time, error, created_at
      FROM queries
      WHERE user_id = '${userId}'
      AND (
        ${columnName} LIKE '%project%${projectId}%' 
        OR ${columnName} LIKE '%${projectId}%'
      )
      ORDER BY created_at DESC
      LIMIT ${limit}
    `)) as Array<{
      id: string;
      user_id: string;
      query?: string;
      nl_query?: string;
      sql_query: string;
      status: string;
      execution_time: number;
      error: string | null;
      created_at: string;
    }>;

    // Convert the result to QueryHistoryItem objects
    const history = (result || []).map((item) => ({
      id: item.id,
      query: item.nl_query || item.query || "",
      sqlQuery: item.sql_query,
      timestamp: new Date(item.created_at),
      status: item.status,
      executionTime: item.execution_time,
      error: item.error || undefined,
    }));

    console.log(
      `[ProjectQueryHistory] Found ${history.length} history items for user ${userId} and project ${projectId}`
    );
    return history;
  } catch (error) {
    console.error("[ProjectQueryHistory] Error getting query history:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[ProjectQueryHistory] Error details: ${errorMessage}`);
    return [];
  }
}

/**
 * Check if a table exists
 * @param tableName Table name
 * @returns Promise<boolean> True if the table exists
 */
async function checkIfTableExists(tableName: string): Promise<boolean> {
  try {
    console.log(`[ProjectQueryHistory] Checking if table ${tableName} exists`);

    const result = (await executeQuery(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = '${tableName}'
      ) as exists
    `)) as Array<{ exists: boolean }>;

    const exists = result && result.length > 0 && result[0].exists;
    console.log(`[ProjectQueryHistory] Table ${tableName} exists: ${exists}`);

    return exists;
  } catch (error) {
    console.error(
      `[ProjectQueryHistory] Error checking if table ${tableName} exists:`,
      error
    );
    return false;
  }
}

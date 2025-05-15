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

    // Get the query history from the database for the specific project
    const result = (await executeQuery(`
      SELECT id, user_id, query_text, status, error, created_at
      FROM queries
      WHERE user_id = '${userId}'
      AND (
        query_text LIKE '%project%${projectId}%'
        OR query_text LIKE '%${projectId}%'
      )
      ORDER BY created_at DESC
      LIMIT ${limit}
    `)) as Array<{
      id: string;
      user_id: string;
      query_text: string;
      status: string;
      error: string | null;
      created_at: string;
    }>;

    // Convert the result to QueryHistoryItem objects
    const history = (result || []).map((item) => ({
      id: item.id,
      query: item.query_text || "",
      sqlQuery: "", // This field is no longer stored in the database
      timestamp: new Date(item.created_at),
      status: item.status,
      executionTime: 0, // This field is no longer stored in the database
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

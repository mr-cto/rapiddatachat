import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

/**
 * Execute a SQL query
 *
 * @param query SQL query string
 * @param params Query parameters
 * @returns Query result
 */
export async function executeQuery(
  query: string,
  params: any[] = []
): Promise<any> {
  try {
    // Check if the query is a SELECT query
    const isSelectQuery = query.trim().toLowerCase().startsWith("select");

    if (isSelectQuery) {
      // Use Prisma for SELECT queries when possible
      try {
        // For simple SELECT queries, try to use Prisma's $queryRaw
        const result = await prisma.$queryRaw`${query}`;
        return result;
      } catch (prismaError) {
        console.warn(
          "Falling back to direct PostgreSQL for SELECT query:",
          prismaError
        );
        // Fall back to direct PostgreSQL connection
        const client = await pool.connect();
        try {
          const result = await client.query(query, params);
          return result.rows;
        } finally {
          client.release();
        }
      }
    } else {
      // For non-SELECT queries (INSERT, UPDATE, DELETE, CREATE TABLE, etc.)
      // Use direct PostgreSQL connection
      const client = await pool.connect();
      try {
        const result = await client.query(query, params);
        return result.rows;
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
}

/**
 * Execute a transaction with multiple queries
 *
 * @param queries Array of query objects with SQL and params
 * @returns Transaction result
 */
export async function executeTransaction(
  queries: Array<{ sql: string; params?: any[] }>
): Promise<any[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const results = [];
    for (const query of queries) {
      const result = await client.query(query.sql, query.params || []);
      results.push(result.rows);
    }

    await client.query("COMMIT");
    return results;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Transaction error:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close database connections
 */
export async function closeConnections(): Promise<void> {
  try {
    await prisma.$disconnect();
    await pool.end();
  } catch (error) {
    console.error("Error closing database connections:", error);
    throw error;
  }
}

export default {
  executeQuery,
  executeTransaction,
  closeConnections,
  prisma,
};

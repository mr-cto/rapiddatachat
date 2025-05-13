import { executeQuery } from "../database";
import { queryCache, recordPerformanceMetrics } from "./performanceMonitoring";

/**
 * Helper function to convert BigInt values to strings in an object
 * @param obj Object that might contain BigInt values
 * @returns Object with BigInt values converted to strings
 */
function convertBigIntToString(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "bigint") {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToString);
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = convertBigIntToString(value);
    }
    return result;
  }

  return obj;
}

// Define the interface for query results
interface QueryResult {
  rows: Record<string, unknown>[];
  error?: string;
  executionTime?: number;
}

// Define the interface for a saved query
interface SavedQuery {
  id: string;
  userId: string;
  naturalLanguageQuery: string;
  sqlQuery: string;
  queryText?: string;
  status?: string;
  timestamp: Date;
  executionTime?: number;
  error?: string;
}

/**
 * QueryService class for executing SQL queries
 * This service is responsible for executing SQL queries and storing query history
 */
export class QueryService {
  /**
   * Execute a SQL query
   * @param sqlQuery SQL query to execute
   * @param userId User ID
   * @param naturalLanguageQuery Original natural language query
   * @returns Promise<QueryResult> Query results
   */
  /**
   * Execute a SQL query with pagination, sorting, and filtering
   * @param sqlQuery SQL query to execute
   * @param userId User ID
   * @param naturalLanguageQuery Original natural language query
   * @param options Pagination, sorting, and filtering options
   * @returns Promise<QueryResult> Query results
   */
  async executeQuery(
    sqlQuery: string,
    userId: string,
    naturalLanguageQuery: string,
    options: {
      page?: number;
      pageSize?: number;
      sortColumn?: string;
      sortDirection?: "asc" | "desc";
      filters?: Record<string, unknown>;
    } = {}
  ): Promise<
    QueryResult & {
      totalRows?: number;
      totalPages?: number;
      currentPage?: number;
    }
  > {
    const startTime = Date.now();
    let error: string | undefined;
    let rows: Record<string, unknown>[] = [];
    let totalRows = 0;
    let totalPages = 0;
    const currentPage = options.page || 1;
    const pageSize = options.pageSize || 100; // Default page size

    try {
      // Apply pagination, sorting, and filtering to the query
      const modifiedQuery = this.applyQueryModifications(
        sqlQuery,
        options.page,
        options.pageSize,
        options.sortColumn,
        options.sortDirection,
        options.filters
      );

      // Generate a cache key based on the query and options
      const cacheKey = `${sqlQuery}_${JSON.stringify(options)}`;

      // Check if we have a cached result
      const cachedResult = queryCache.get(cacheKey);
      if (cachedResult) {
        // Use cached result
        return cachedResult as QueryResult & {
          totalRows?: number;
          totalPages?: number;
          currentPage?: number;
        };
      }

      // Get total count for pagination
      const countQuery = this.buildCountQuery(sqlQuery);
      const countResult = await this.executeQueryWithTimeout(countQuery, 30000);
      // Handle the count result safely
      if (
        Array.isArray(countResult) &&
        countResult.length > 0 &&
        countResult[0]
      ) {
        const firstValue = Object.values(
          countResult[0] as Record<string, unknown>
        )[0];
        if (firstValue !== undefined) {
          totalRows =
            typeof firstValue === "number"
              ? firstValue
              : parseInt(String(firstValue), 10) || 0;
        }
      }
      totalPages = Math.ceil(totalRows / pageSize);

      // Execute the modified query with a timeout
      const result = await this.executeQueryWithTimeout(modifiedQuery, 30000); // 30 second timeout

      // Convert any BigInt values to strings
      const processedResult = convertBigIntToString(result) as Record<
        string,
        unknown
      >[];
      rows = processedResult;
    } catch (err) {
      error = err instanceof Error ? err.message : "Unknown error";
      console.error("Error executing query:", error);
    }

    const executionTime = Date.now() - startTime;

    // Record performance metrics
    recordPerformanceMetrics({
      executionTime,
      querySize: sqlQuery.length,
      resultSize: rows.length,
      timestamp: new Date(),
      userId,
      queryId: undefined,
    });

    // Save the query to the database
    await this.saveQuery({
      userId,
      naturalLanguageQuery,
      _sqlQuery: sqlQuery,
      _executionTime: executionTime,
      error,
    });

    const queryResult = {
      rows,
      error,
      executionTime,
      totalRows,
      totalPages,
      currentPage,
    };

    // Cache the result if there's no error
    if (!error) {
      queryCache.set(sqlQuery, queryResult);
    }

    return queryResult;
  }

  /**
   * Apply pagination, sorting, and filtering to a SQL query
   * @param sqlQuery Original SQL query
   * @param page Page number (1-based)
   * @param pageSize Number of rows per page
   * @param sortColumn Column to sort by
   * @param sortDirection Sort direction (asc or desc)
   * @param filters Filters to apply
   * @returns Modified SQL query
   */
  private applyQueryModifications(
    sqlQuery: string,
    page?: number,
    pageSize?: number,
    sortColumn?: string,
    sortDirection?: "asc" | "desc",
    filters?: Record<string, unknown>
  ): string {
    let modifiedQuery = sqlQuery.trim();

    // Apply filters if provided
    if (filters && Object.keys(filters).length > 0) {
      modifiedQuery = this.applyFilters(modifiedQuery, filters);
    }

    // Apply sorting if provided
    if (sortColumn) {
      modifiedQuery = this.applySorting(
        modifiedQuery,
        sortColumn,
        sortDirection
      );
    }

    // Apply pagination if provided
    if (page && pageSize) {
      modifiedQuery = this.applyPagination(modifiedQuery, page, pageSize);
    }

    return modifiedQuery;
  }

  /**
   * Apply filters to a SQL query
   * @param sqlQuery Original SQL query
   * @param filters Filters to apply
   * @returns Modified SQL query
   */
  private applyFilters(
    sqlQuery: string,
    filters: Record<string, unknown>
  ): string {
    // Check if the query already has a WHERE clause
    const hasWhere = /\bWHERE\b/i.test(sqlQuery);

    // Start building the filter clause
    let filterClause = hasWhere ? " AND " : " WHERE ";

    // Add each filter
    const filterConditions = Object.entries(filters).map(([column, value]) => {
      // Sanitize the column name to prevent SQL injection
      const sanitizedColumn = column.replace(/[^\w\d_]/g, "");

      // Handle different types of values
      if (value === null) {
        return `${sanitizedColumn} IS NULL`;
      } else if (typeof value === "string") {
        // Sanitize the string value to prevent SQL injection
        const sanitizedValue = value.replace(/'/g, "''");
        return `${sanitizedColumn} = '${sanitizedValue}'`;
      } else if (typeof value === "number" || typeof value === "boolean") {
        return `${sanitizedColumn} = ${value}`;
      } else if (Array.isArray(value)) {
        // Handle array values (IN operator)
        const sanitizedValues = value
          .map((v) => {
            if (typeof v === "string") {
              return `'${v.replace(/'/g, "''")}'`;
            }
            return v;
          })
          .join(", ");
        return `${sanitizedColumn} IN (${sanitizedValues})`;
      } else if (typeof value === "object") {
        // Handle range values (BETWEEN operator)
        const range = value as { min?: number | string; max?: number | string };
        if (range.min !== undefined && range.max !== undefined) {
          const min =
            typeof range.min === "string"
              ? `'${range.min.replace(/'/g, "''")}'`
              : range.min;
          const max =
            typeof range.max === "string"
              ? `'${range.max.replace(/'/g, "''")}'`
              : range.max;
          return `${sanitizedColumn} BETWEEN ${min} AND ${max}`;
        } else if (range.min !== undefined) {
          const min =
            typeof range.min === "string"
              ? `'${range.min.replace(/'/g, "''")}'`
              : range.min;
          return `${sanitizedColumn} >= ${min}`;
        } else if (range.max !== undefined) {
          const max =
            typeof range.max === "string"
              ? `'${range.max.replace(/'/g, "''")}'`
              : range.max;
          return `${sanitizedColumn} <= ${max}`;
        }
      }

      // Default case
      return `${sanitizedColumn} = ${value}`;
    });

    // Join all filter conditions
    filterClause += filterConditions.join(" AND ");

    // Find the position to insert the filter clause
    const orderByPos = sqlQuery.toUpperCase().indexOf(" ORDER BY ");
    const limitPos = sqlQuery.toUpperCase().indexOf(" LIMIT ");
    const groupByPos = sqlQuery.toUpperCase().indexOf(" GROUP BY ");

    let insertPos = sqlQuery.length;
    if (orderByPos > 0) insertPos = orderByPos;
    else if (limitPos > 0) insertPos = limitPos;
    else if (groupByPos > 0) insertPos = groupByPos;

    // Insert the filter clause
    return (
      sqlQuery.slice(0, insertPos) + filterClause + sqlQuery.slice(insertPos)
    );
  }

  /**
   * Apply sorting to a SQL query
   * @param sqlQuery Original SQL query
   * @param sortColumn Column to sort by
   * @param sortDirection Sort direction (asc or desc)
   * @returns Modified SQL query
   */
  private applySorting(
    sqlQuery: string,
    sortColumn: string,
    sortDirection?: "asc" | "desc"
  ): string {
    // Sanitize the column name to prevent SQL injection
    const sanitizedColumn = sortColumn.replace(/[^\w\d_]/g, "");

    // Default sort direction to ascending
    const direction = sortDirection?.toUpperCase() === "DESC" ? "DESC" : "ASC";

    // Check if the query already has an ORDER BY clause
    const orderByPos = sqlQuery.toUpperCase().indexOf(" ORDER BY ");

    if (orderByPos > 0) {
      // If there's already an ORDER BY clause, append to it
      const limitPos = sqlQuery.toUpperCase().indexOf(" LIMIT ", orderByPos);
      if (limitPos > 0) {
        // If there's a LIMIT clause after ORDER BY, insert before it
        return (
          sqlQuery.slice(0, limitPos) +
          `, ${sanitizedColumn} ${direction}` +
          sqlQuery.slice(limitPos)
        );
      } else {
        // Otherwise, append to the end
        return sqlQuery + `, ${sanitizedColumn} ${direction}`;
      }
    } else {
      // If there's no ORDER BY clause, add one
      const limitPos = sqlQuery.toUpperCase().indexOf(" LIMIT ");
      if (limitPos > 0) {
        // If there's a LIMIT clause, insert before it
        return (
          sqlQuery.slice(0, limitPos) +
          ` ORDER BY ${sanitizedColumn} ${direction}` +
          sqlQuery.slice(limitPos)
        );
      } else {
        // Otherwise, append to the end
        return sqlQuery + ` ORDER BY ${sanitizedColumn} ${direction}`;
      }
    }
  }

  /**
   * Apply pagination to a SQL query
   * @param sqlQuery Original SQL query
   * @param page Page number (1-based)
   * @param pageSize Number of rows per page
   * @returns Modified SQL query
   */
  private applyPagination(
    sqlQuery: string,
    page: number,
    pageSize: number
  ): string {
    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Check if the query already has a LIMIT clause
    const limitPos = sqlQuery.toUpperCase().indexOf(" LIMIT ");

    // Remove any trailing semicolons before adding LIMIT
    const cleanQuery = sqlQuery.trim().replace(/;$/, "");

    if (limitPos > 0) {
      // If there's already a LIMIT clause, replace it
      return (
        cleanQuery.slice(0, limitPos) + ` LIMIT ${pageSize} OFFSET ${offset}`
      );
    } else {
      // Otherwise, append to the end
      return cleanQuery + ` LIMIT ${pageSize} OFFSET ${offset}`;
    }
  }

  /**
   * Build a count query from a SELECT query
   * @param sqlQuery Original SQL query
   * @returns Count query
   */
  private buildCountQuery(sqlQuery: string): string {
    // Remove any existing ORDER BY and LIMIT clauses
    let countQuery = sqlQuery.replace(/\bORDER BY\b.*?(?=\bLIMIT\b|$)/i, "");
    countQuery = countQuery.replace(/\bLIMIT\b.*?(?=$)/i, "");

    // Wrap the query in a COUNT(*) query
    return `SELECT COUNT(*) FROM (${countQuery}) AS count_query`;
  }

  /**
   * Execute a query with a timeout
   * @param sqlQuery SQL query to execute
   * @param timeout Timeout in milliseconds
   * @returns Promise<unknown> Query results
   */
  private async executeQueryWithTimeout(
    sqlQuery: string,
    timeout: number
  ): Promise<unknown> {
    const startTime = performance.now();

    try {
      // Check if we have a cached result for this exact query
      const cachedResult = queryCache.get(sqlQuery);
      if (cachedResult) {
        return cachedResult as unknown[];
      }

      const result = await new Promise((resolve, reject) => {
        // Set a timeout
        const timeoutId = setTimeout(() => {
          reject(new Error(`Query execution timed out after ${timeout}ms`));
        }, timeout);

        // Execute the query
        executeQuery(sqlQuery)
          .then((result) => {
            clearTimeout(timeoutId);
            resolve(result);
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            reject(error);
          });
      });

      // Cache the result
      queryCache.set(sqlQuery, result);

      // Record performance metrics
      const executionTime = performance.now() - startTime;
      recordPerformanceMetrics({
        executionTime,
        querySize: sqlQuery.length,
        resultSize: Array.isArray(result) ? result.length : 0,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      // Record performance metrics even for failed queries
      const executionTime = performance.now() - startTime;
      recordPerformanceMetrics({
        executionTime,
        querySize: sqlQuery.length,
        resultSize: 0,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Save a query to the database
   * @param query Query to save
   * @returns Promise<void>
   */
  private async saveQuery({
    userId,
    naturalLanguageQuery,
    // sqlQuery and executionTime are currently unused but kept for future use
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _sqlQuery,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _executionTime,
    error,
  }: {
    userId: string;
    naturalLanguageQuery: string;
    _sqlQuery: string;
    _executionTime?: number;
    error?: string;
  }): Promise<void> {
    try {
      // Sanitize the natural language query for SQL insertion
      const sanitizedNaturalLanguageQuery = naturalLanguageQuery.replace(
        /'/g,
        "''"
      );
      const sanitizedError = error ? error.replace(/'/g, "''") : null;

      // Insert the query into the database
      // Include the id field with a UUID value
      await executeQuery(`
        INSERT INTO queries (
          id, user_id, query_text, status, error, created_at
        ) VALUES (
          gen_random_uuid(),
          '${userId}',
          '${sanitizedNaturalLanguageQuery}',
          'completed',
          ${sanitizedError ? `'${sanitizedError}'` : "NULL"},
          CURRENT_TIMESTAMP
        )
      `);
    } catch (error) {
      console.error("Error saving query:", error);
    }
  }

  /**
   * Get query history for a user
   * @param userId User ID
   * @param limit Number of queries to return
   * @returns Promise<SavedQuery[]> Query history
   */
  async getQueryHistory(
    userId: string,
    limit: number = 10
  ): Promise<SavedQuery[]> {
    try {
      const result = (await executeQuery(`
        SELECT id, user_id, query_text, status, created_at, error
        FROM queries
        WHERE user_id = '${userId}'
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

      return result.map((row) => ({
        id: row.id,
        userId: row.user_id,
        naturalLanguageQuery: row.query_text, // Use query_text as naturalLanguageQuery
        sqlQuery: "", // We don't have this column, so use empty string
        queryText: row.query_text,
        status: row.status,
        executionTime: undefined, // We don't have this column, so use undefined
        error: row.error || undefined,
        timestamp: new Date(row.created_at),
      }));
    } catch (error) {
      console.error("Error getting query history:", error);
      return [];
    }
  }

  /**
   * Validate a SQL query
   * @param sqlQuery SQL query to validate
   * @param options Pagination, sorting, and filtering options
   * @returns Promise<{ isValid: boolean; error?: string }> Validation result
   */
  async validateQuery(
    sqlQuery: string,
    options?: {
      page?: number;
      pageSize?: number;
      sortColumn?: string;
      sortDirection?: "asc" | "desc";
      filters?: Record<string, unknown>;
    }
  ): Promise<{ isValid: boolean; error?: string; sqlQuery?: string }> {
    try {
      // Check for and fix common truncation issues
      const fixedQuery = this.fixTruncatedQuery(sqlQuery);

      // Check if the query is a SELECT query
      const trimmedQuery = fixedQuery.trim().toUpperCase();
      console.log("Validating SQL query:", fixedQuery);
      console.log(
        "Trimmed uppercase query starts with:",
        trimmedQuery.substring(0, 10)
      );

      if (!trimmedQuery.startsWith("SELECT")) {
        console.log("Query validation failed: Not a SELECT query");

        // Check if the SQL query is actually an informational message from the LLM
        if (
          fixedQuery.length > 20 &&
          !fixedQuery.includes(";") &&
          (fixedQuery.toLowerCase().includes("cannot be answered") ||
            fixedQuery.toLowerCase().includes("not available") ||
            fixedQuery.toLowerCase().includes("no data") ||
            fixedQuery.toLowerCase().includes("field is not available"))
        ) {
          // This appears to be an informational message, return it directly
          return {
            isValid: false,
            error: fixedQuery, // Use the full message as the error
            sqlQuery: fixedQuery,
          };
        } else {
          // This is a non-SELECT query, return the standard error
          return {
            isValid: false,
            error:
              "Only SELECT queries are allowed. Please rephrase your question to ask for information retrieval rather than data modification.",
            sqlQuery: fixedQuery, // Include the SQL query in the response
          };
        }
      }

      // Check for dangerous operations
      const dangerousOperations = [
        "DROP",
        "DELETE",
        "TRUNCATE",
        "UPDATE",
        "INSERT",
        "ALTER",
        "CREATE",
        "GRANT",
        "REVOKE",
      ];

      for (const operation of dangerousOperations) {
        // Use a more precise regex to check for actual SQL operations
        // This looks for the operation as a standalone word, not as part of another word
        const operationRegex = new RegExp(`\\b${operation}\\b`, "i");
        if (operationRegex.test(fixedQuery.toUpperCase())) {
          return {
            isValid: false,
            error: `Query contains dangerous operation: ${operation}`,
            sqlQuery: fixedQuery,
          };
        }
      }

      // Validate pagination options
      if (
        options?.page !== undefined &&
        (options.page < 1 || !Number.isInteger(options.page))
      ) {
        return {
          isValid: false,
          error: "Page number must be a positive integer",
          sqlQuery: fixedQuery,
        };
      }

      if (
        options?.pageSize !== undefined &&
        (options.pageSize < 1 || !Number.isInteger(options.pageSize))
      ) {
        return {
          isValid: false,
          error: "Page size must be a positive integer",
          sqlQuery: fixedQuery,
        };
      }

      // Validate sorting options
      if (options?.sortColumn && typeof options.sortColumn !== "string") {
        return {
          isValid: false,
          error: "Sort column must be a string",
          sqlQuery: fixedQuery,
        };
      }

      if (
        options?.sortDirection &&
        !["asc", "desc"].includes(options.sortDirection)
      ) {
        return {
          isValid: false,
          error: "Sort direction must be 'asc' or 'desc'",
          sqlQuery: fixedQuery,
        };
      }

      // Validate filters
      if (options?.filters && typeof options.filters !== "object") {
        return {
          isValid: false,
          error: "Filters must be an object",
          sqlQuery: fixedQuery,
        };
      }

      // Try to explain the query to validate it
      // First, apply the modifications to the query
      let modifiedQuery = fixedQuery;
      if (options) {
        try {
          modifiedQuery = this.applyQueryModifications(
            fixedQuery, // Use the fixed query instead of the original
            options.page,
            options.pageSize,
            options.sortColumn,
            options.sortDirection,
            options.filters
          );
        } catch (modificationError) {
          return {
            isValid: false,
            error:
              modificationError instanceof Error
                ? `Error applying query modifications: ${modificationError.message}`
                : "Unknown error applying query modifications",
            sqlQuery: fixedQuery,
          };
        }
      }

      // Validate the modified query
      try {
        // First, check if the query contains any table names that need to be replaced with view names
        // This is a common issue with the LLM-generated queries
        const tableNameRegex = /FROM\s+"?([a-zA-Z0-9_]+)"?/i;
        const tableMatch = modifiedQuery.match(tableNameRegex);

        if (tableMatch && tableMatch[1]) {
          const tableName = tableMatch[1];

          // Check if this is likely a file table name that needs to be a view
          if (
            tableName.includes("_xlsx") ||
            tableName.toLowerCase().includes("attorney_data_scenarios") ||
            (!tableName.startsWith("data_") && !tableName.startsWith("user_"))
          ) {
            // Try to find the correct view name from the database
            try {
              // First check if we have view metadata that can help us
              let viewsResult;

              try {
                // Check if view_metadata table exists
                const metadataTableExists = (await executeQuery(`
                  SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'view_metadata'
                  ) as exists
                `)) as Array<{ exists: boolean }>;

                const exists =
                  metadataTableExists &&
                  Array.isArray(metadataTableExists) &&
                  metadataTableExists.length > 0 &&
                  metadataTableExists[0].exists;

                if (exists) {
                  // Try to find a view that matches the original filename
                  const cleanTableName = tableName.replace(/_xlsx$/, "");
                  viewsResult = (await executeQuery(`
                    SELECT view_name as table_name
                    FROM view_metadata
                    WHERE original_filename ILIKE '%${tableName}%'
                    OR original_filename ILIKE '%${cleanTableName}%'
                    LIMIT 1
                  `)) as Array<{ table_name: string }>;

                  if (!viewsResult || viewsResult.length === 0) {
                    // If no match by filename, just get the most recent view
                    viewsResult = (await executeQuery(`
                      SELECT view_name as table_name
                      FROM view_metadata
                      ORDER BY created_at DESC
                      LIMIT 1
                    `)) as Array<{ table_name: string }>;
                  }
                }
              } catch (metadataError) {
                console.error("Error checking view_metadata:", metadataError);
              }

              // If we couldn't find a view through metadata, fall back to information_schema
              if (
                !viewsResult ||
                !Array.isArray(viewsResult) ||
                viewsResult.length === 0
              ) {
                viewsResult = await executeQuery(`
                  SELECT table_name
                  FROM information_schema.views
                  WHERE table_name LIKE 'data_%' OR table_name LIKE 'user_%'
                  ORDER BY table_name
                `);
              }

              if (Array.isArray(viewsResult) && viewsResult.length > 0) {
                console.log(
                  `Found ${viewsResult.length} views that might match`
                );

                // Use the first view as a fallback
                const firstView = viewsResult[0].table_name;

                // Replace the table name in the query
                let correctedQuery = modifiedQuery;

                // Try different patterns of the table name
                const patterns = [
                  `"${tableName}"`,
                  tableName,
                  `"${tableName.toLowerCase()}"`,
                  tableName.toLowerCase(),
                ];

                for (const pattern of patterns) {
                  correctedQuery = correctedQuery.replace(
                    new RegExp(`FROM\\s+${pattern}\\b`, "gi"),
                    `FROM ${firstView}`
                  );
                }

                console.log(`Corrected query: ${correctedQuery}`);

                // Try to validate the corrected query
                try {
                  const cleanQuery = correctedQuery.trim().replace(/;/g, "");
                  const queryForExplain = `EXPLAIN ${cleanQuery}`;
                  await executeQuery(queryForExplain);

                  // If we get here, the corrected query is valid
                  return { isValid: true, sqlQuery: correctedQuery };
                } catch (correctedError) {
                  // If the corrected query still fails, continue with normal validation
                  console.log(
                    `Corrected query validation failed: ${correctedError}`
                  );
                }
              }
            } catch (viewsError) {
              console.error("Error fetching views:", viewsError);
            }
          }
        }

        // Ensure the query is properly formatted for EXPLAIN
        // Remove any semicolons for Prisma compatibility
        const cleanQuery = modifiedQuery.trim().replace(/;/g, "");
        const queryForExplain = `EXPLAIN ${cleanQuery}`;

        await executeQuery(queryForExplain);
      } catch (explainError) {
        console.error("Error validating query:", explainError);

        // Check if the error is about a relation not existing
        const errorMessage =
          explainError instanceof Error
            ? explainError.message
            : "Invalid SQL query";

        if (
          errorMessage.includes("relation") &&
          errorMessage.includes("does not exist")
        ) {
          // Extract the table name from the error message if possible
          const tableNameMatch = errorMessage.match(
            /relation "([^"]+)" does not exist/
          );
          const tableName = tableNameMatch ? tableNameMatch[1] : "unknown";

          // Try to get the actual view names from the database
          try {
            const viewsResult = await executeQuery(`
              SELECT table_name
              FROM information_schema.views
              WHERE table_name LIKE 'user_%'
              LIMIT 1
            `);

            if (Array.isArray(viewsResult) && viewsResult.length > 0) {
              const exampleView = viewsResult[0].table_name;

              return {
                isValid: false,
                error: `Table "${tableName}" does not exist. The system uses view names like "${exampleView}" for data tables. Please use the exact view name from the schema information.`,
                sqlQuery: fixedQuery,
              };
            }
          } catch (viewsError) {
            console.error(
              "Error fetching views for error message:",
              viewsError
            );
          }

          // Fallback error message if we couldn't get the views
          return {
            isValid: false,
            error: `Table "${tableName}" does not exist. The system uses view names like "user_t_mrcto_ai_file_..." for data tables. Please check the schema information for the correct table name.`,
            sqlQuery: fixedQuery,
          };
        }

        return {
          isValid: false,
          error: `Invalid SQL query: ${errorMessage}`,
          sqlQuery: fixedQuery,
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Unknown error",
        sqlQuery: sqlQuery, // Use original sqlQuery since fixedQuery might not be defined in this scope
      };
    }
  }

  /**
   * Fix common issues with truncated queries
   * @param sqlQuery SQL query to fix
   * @returns Fixed SQL query
   */
  private fixTruncatedQuery(sqlQuery: string): string {
    let fixedQuery = sqlQuery;

    // First, check for unterminated quoted strings as this is the most critical
    const singleQuoteCount = (fixedQuery.match(/'/g) || []).length;
    if (singleQuoteCount % 2 !== 0) {
      console.log("Fixing unterminated quoted string");
      fixedQuery = fixedQuery + "'";
    }

    // Check for unterminated ARRAY constructor
    if (fixedQuery.includes("ARRAY[") && !fixedQuery.includes("]")) {
      console.log("Fixing unterminated ARRAY constructor");
      fixedQuery = fixedQuery + "]";
    }

    // Check for ILIKE ANY without proper ARRAY syntax
    const ilikeAnyPattern = /ILIKE\s+ANY\s*\(\s*(?!ARRAY)/i;
    if (ilikeAnyPattern.test(fixedQuery)) {
      console.log("Fixing ILIKE ANY without ARRAY constructor");
      fixedQuery = fixedQuery.replace(
        /ILIKE\s+ANY\s*\(\s*([^)]+)\)/gi,
        "ILIKE ANY(ARRAY[$1])"
      );
    }

    // Special case for complex queries with both IN clause and AND condition
    // This needs to be done before general parenthesis fixing
    if (
      fixedQuery.includes("IN ('") &&
      fixedQuery.includes(" AND (") &&
      !fixedQuery.includes("')")
    ) {
      console.log("Fixing complex IN clause with AND condition");
      // Find the position of the IN clause
      const inClausePos = fixedQuery.indexOf("IN (");
      if (inClausePos > 0) {
        // Find the position of the AND after the IN clause
        const andPos = fixedQuery.indexOf(" AND ", inClausePos);
        if (andPos > 0) {
          // Insert a closing parenthesis before the AND
          fixedQuery =
            fixedQuery.substring(0, andPos) +
            ")" +
            fixedQuery.substring(andPos);
        }
      }
    }

    // Check for truncated IN clauses specifically
    else if (fixedQuery.includes("IN (") && !fixedQuery.includes(")")) {
      console.log("Fixing truncated IN clause");
      fixedQuery = fixedQuery + ")";
    }

    // Check for missing closing parentheses in general
    const openParenCount = (fixedQuery.match(/\(/g) || []).length;
    const closeParenCount = (fixedQuery.match(/\)/g) || []).length;
    if (openParenCount > closeParenCount) {
      console.log("Fixing missing closing parentheses");
      for (let i = 0; i < openParenCount - closeParenCount; i++) {
        fixedQuery = fixedQuery + ")";
      }
    }

    // If the query was fixed, log the changes
    if (fixedQuery !== sqlQuery) {
      console.log("Original query:", sqlQuery);
      console.log("Fixed query:", fixedQuery);
    }

    return fixedQuery;
  }
}

/**
 * Create an instance of the query service
 * @returns QueryService instance
 */
export function createQueryService(): QueryService {
  return new QueryService();
}

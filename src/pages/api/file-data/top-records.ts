import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { executeQuery } from "../../../../lib/database";

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

/**
 * Process column merges for the results
 * @param results The query results
 * @param columnMerges The column merge configurations
 * @returns The processed results with merged columns
 */
function processColumnMerges(
  results: Record<string, unknown>[],
  columnMerges: any[]
): Record<string, unknown>[] {
  if (
    !Array.isArray(results) ||
    results.length === 0 ||
    !Array.isArray(columnMerges) ||
    columnMerges.length === 0
  ) {
    return results;
  }

  // Create a deep copy of the results to avoid modifying the original
  const processedResults = JSON.parse(JSON.stringify(results));

  // Process each result row
  processedResults.forEach((row: Record<string, unknown>) => {
    // Apply each column merge to the row
    columnMerges.forEach((merge) => {
      const { merge_name, column_list, delimiter } = merge;

      if (
        !merge_name ||
        !Array.isArray(column_list) ||
        column_list.length === 0
      ) {
        return;
      }

      // Get the values for each column in the merge
      const values = column_list
        .map((col) => {
          // Extract the value from the data column if it exists
          if (row.data && typeof row.data === "object") {
            const dataObj = row.data as Record<string, unknown>;
            return dataObj[col] !== undefined ? String(dataObj[col]) : "";
          }

          // Otherwise try to get it directly from the row
          return row[col] !== undefined ? String(row[col]) : "";
        })
        .filter(Boolean); // Remove empty values

      // Create the merged value
      const mergedValue = values.join(delimiter || " ");

      // Add the merged column to the row
      row[merge_name] = mergedValue;
    });
  });

  return processedResults;
}

/**
 * API handler for retrieving top records from a project with schema manipulations
 *
 * @param req NextApiRequest - The request object containing:
 *   - projectId: ID of the project to fetch records for
 *   - limit: Maximum number of records to return (default: 10)
 *   - visibleColumns: Array of column names to include in the response (optional)
 *   - columnOrder: Array specifying the order of columns in the response (optional)
 * @param res NextApiResponse - The response object
 * @returns JSON response with processed records and metadata
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check authentication
  const session = await getServerSession(req, res, authOptions);

  // In development, allow requests without authentication for testing
  const isDevelopment = process.env.NODE_ENV === "development";
  if ((!session || !session.user) && !isDevelopment) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const {
      projectId,
      limit = 10,
      visibleColumns = [],
      columnOrder = [],
    } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    // Get the top records from file_data for the specified project
    const startTime = Date.now();
    const query = `
      SELECT fd.* 
      FROM file_data fd 
      JOIN files f ON fd.file_id = f.id 
      WHERE f.project_id = '${projectId}'
      FETCH FIRST ${limit} ROWS ONLY
    `;

    const results = (await executeQuery(query)) as Record<string, unknown>[];

    // Get column merges for this project
    const columnMergesQuery = `
      SELECT * FROM column_merges
      WHERE file_id IN (
        SELECT id FROM files WHERE project_id = '${projectId}'
      )
    `;

    const columnMergesResult = (await executeQuery(
      columnMergesQuery
    )) as Record<string, unknown>[];

    // Transform column merges to ensure they have the expected structure
    const columnMerges = Array.isArray(columnMergesResult)
      ? columnMergesResult.map((merge) => ({
          merge_name: merge.merge_name || merge.mergeName,
          column_list: merge.column_list || merge.columnList || [],
          delimiter: merge.delimiter || " ",
        }))
      : [];

    console.log(
      `[top-records] Found ${columnMerges.length} column merges for project ${projectId}`
    );
    if (columnMerges.length > 0) {
      console.log(
        `[top-records] Column merges:`,
        JSON.stringify(columnMerges, null, 2)
      );
    }

    // Apply column merges to the results
    let processedResults = results;
    if (columnMerges.length > 0) {
      console.log(
        `[top-records] Applying column merges to ${results.length} results`
      );
      processedResults = processColumnMerges(results, columnMerges);
      console.log(
        `[top-records] Column merges applied, sample result:`,
        processedResults.length > 0
          ? JSON.stringify(processedResults[0], null, 2)
          : "No results"
      );
    }

    // Apply column filtering if visibleColumns is provided and not empty
    if (visibleColumns.length > 0) {
      console.log(
        `[top-records] Filtering columns to only include: ${visibleColumns.join(
          ", "
        )}`
      );
      processedResults = processedResults.map((row) => {
        const filteredRow: Record<string, unknown> = {};
        // Include only visible columns
        visibleColumns.forEach((column) => {
          if (row.hasOwnProperty(column)) {
            filteredRow[column] = row[column];
          }
        });
        return filteredRow;
      });
      console.log(
        `[top-records] Column filtering applied, sample result:`,
        processedResults.length > 0
          ? JSON.stringify(processedResults[0], null, 2)
          : "No results"
      );
    }

    // Apply column ordering if columnOrder is provided and not empty
    if (columnOrder.length > 0) {
      console.log(
        `[top-records] Reordering columns according to: ${columnOrder.join(
          ", "
        )}`
      );
      processedResults = processedResults.map((row) => {
        const orderedRow: Record<string, unknown> = {};
        // Add columns in the specified order
        columnOrder.forEach((column) => {
          if (row.hasOwnProperty(column)) {
            orderedRow[column] = row[column];
          }
        });

        // Add any remaining columns that weren't in columnOrder but are in the row
        // This ensures we don't lose any data
        Object.keys(row).forEach((column) => {
          if (!columnOrder.includes(column)) {
            orderedRow[column] = row[column];
          }
        });

        return orderedRow;
      });
      console.log(
        `[top-records] Column ordering applied, sample result:`,
        processedResults.length > 0
          ? JSON.stringify(processedResults[0], null, 2)
          : "No results"
      );
    }

    const executionTime = Date.now() - startTime;

    // Convert any BigInt values to strings before serializing to JSON
    const serializedResults = convertBigIntToString(processedResults);

    // Get total count of records for pagination info
    const countQuery = `
      SELECT COUNT(*) as total
      FROM file_data fd 
      JOIN files f ON fd.file_id = f.id 
      WHERE f.project_id = '${projectId}'
    `;

    const countResult = (await executeQuery(countQuery)) as Array<{
      total: number | bigint;
    }>;
    const totalRows = countResult[0]?.total || 0;

    // Convert all BigInt values to strings in the response
    const response = {
      results: serializedResults,
      executionTime,
      totalRows:
        typeof totalRows === "bigint" ? totalRows.toString() : totalRows,
      columnMerges: convertBigIntToString(columnMerges),
      appliedFilters: {
        visibleColumns,
        columnOrder,
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching top records:", error);
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
}

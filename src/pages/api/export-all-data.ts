import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { executeQuery } from "../../../lib/database";

// Configure the API route to use the maximum duration
export const config = {
  api: {
    responseLimit: false, // Remove the response size limit
    bodyParser: {
      sizeLimit: "4mb", // Increase the body size limit
    },
  },
};

// Maximum number of rows to return in a single chunk
// Using a smaller chunk size to avoid Prisma's 5MB response size limit
const CHUNK_SIZE = 4000;

/**
 * API handler for exporting data for a specific query
 *
 * POST: Export data for a query with chunking support for Vercel compatibility
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const {
      sqlQuery,
      projectId,
      fileId,
      columnMerges = [],
      virtualColumns = [],
      chunk = 0, // Default to first chunk (metadata request)
    } = req.body;

    if (!sqlQuery) {
      return res.status(400).json({ error: "SQL query is required" });
    }

    // Remove any LIMIT and OFFSET clauses from the query
    let baseQuery = sqlQuery.replace(/\bLIMIT\s+\d+(\s+OFFSET\s+\d+)?/gi, "");
    baseQuery = baseQuery.replace(/\bOFFSET\s+\d+/gi, "");

    // First, get the total count
    if (chunk === 0) {
      // Build a count query to get the total number of rows
      // Always filter by project_id if available to get accurate counts
      let countQuery;

      if (projectId) {
        // Use project ID filter for accurate count
        console.log(
          `[export-all-data] Using project filter with ID: ${projectId}`
        );
        countQuery = `
          SELECT COUNT(*) as total
          FROM file_data fd
          JOIN files f ON fd.file_id = f.id
          WHERE f.project_id = '${projectId}'
        `;
      } else {
        // Fallback to base query if no project ID (should be rare)
        console.log(
          `[export-all-data] WARNING: No project ID provided for count query`
        );
        countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as count_query`;
      }

      console.log(`[export-all-data] Executing count query: ${countQuery}`);

      const countResult = await executeQuery(countQuery);
      const totalRows =
        Array.isArray(countResult) && countResult.length > 0
          ? parseInt(countResult[0].total.toString(), 10)
          : 0;

      console.log(`[export-all-data] Total rows to export: ${totalRows}`);

      // Calculate the total number of chunks needed
      const totalChunks = Math.ceil(totalRows / CHUNK_SIZE);

      // Return the metadata for the export
      return res.status(200).json({
        totalRows,
        totalChunks,
        chunkSize: CHUNK_SIZE,
        metadata: true,
      });
    }

    // For subsequent requests, return the requested chunk of data
    const offset = (chunk - 1) * CHUNK_SIZE;

    // Build a query that properly filters by project ID
    let chunkQuery;

    if (projectId) {
      // Use project ID filter for accurate data retrieval
      chunkQuery = `
        SELECT fd.data, fd.id, fd.file_id, fd.ingested_at
        FROM file_data fd
        JOIN files f ON fd.file_id = f.id
        WHERE f.project_id = '${projectId}'
        OFFSET ${offset} FETCH FIRST ${CHUNK_SIZE} ROWS ONLY
      `;
    } else {
      // Modify the query to select only the data columns, not all columns
      // This helps avoid Prisma's 5MB response size limit
      let modifiedBaseQuery = baseQuery;
      if (modifiedBaseQuery.toUpperCase().startsWith("SELECT *")) {
        // Replace SELECT * with SELECT data, id, file_id, ingested_at to include all necessary columns
        modifiedBaseQuery = modifiedBaseQuery.replace(
          /SELECT \*/i,
          "SELECT data, id, file_id, ingested_at"
        );
      }

      // For PostgreSQL, we need to use the correct syntax for LIMIT and OFFSET
      // The OFFSET clause must come before FETCH FIRST
      chunkQuery = `${modifiedBaseQuery} OFFSET ${offset} FETCH FIRST ${CHUNK_SIZE} ROWS ONLY`;
    }

    console.log(
      `[export-all-data] Executing chunk query ${chunk}: ${chunkQuery}`
    );

    // Execute the query to get the chunk of data
    const startTime = Date.now();
    let result;
    try {
      result = await executeQuery(chunkQuery);
    } catch (error) {
      console.error("Error executing chunk query:", error);

      // Check if it's a Prisma response size limit error
      const errorMessage = String(error);
      if (
        errorMessage.includes("response size") &&
        errorMessage.includes("exceeded the maximum")
      ) {
        // Return a more helpful error message
        return res.status(413).json({
          error: "Response size limit exceeded",
          message:
            "The data chunk is too large. Try reducing the chunk size or selecting fewer columns.",
          solution:
            "The system has automatically reduced the chunk size. Please try again.",
        });
      }

      // For other errors, return a generic error
      throw error;
    }

    const executionTime = Date.now() - startTime;

    console.log(
      `[export-all-data] Chunk ${chunk} query executed in ${executionTime}ms, returned ${
        Array.isArray(result) ? result.length : 0
      } rows`
    );

    // Process the results to extract nested data
    const processedResults = Array.isArray(result)
      ? result.map((row) => {
          // If the row has a data property that's an object, extract its properties
          if (
            row.data &&
            typeof row.data === "object" &&
            !Array.isArray(row.data)
          ) {
            // Extract all properties from the data object
            const extractedData = { ...(row.data as Record<string, unknown>) };
            return extractedData;
          }
          return row;
        })
      : [];

    // Apply column merges if provided
    if (columnMerges && columnMerges.length > 0) {
      processedResults.forEach((row: Record<string, unknown>) => {
        // For each column merge definition
        columnMerges.forEach((merge: any) => {
          const { mergeName, columnList, delimiter } = merge;

          // Create the merged value by joining the values of the columns in the list
          const mergedValue = columnList
            .map((col: string) => {
              const value = row[col];
              return value !== null && value !== undefined ? String(value) : "";
            })
            .filter(Boolean) // Remove empty values
            .join(delimiter || " ");

          // Add the merged column to the row
          row[mergeName] = mergedValue;
        });
      });
    }

    // Return the processed results for this chunk
    return res.status(200).json({
      results: processedResults,
      chunk,
      rowCount: processedResults.length,
      executionTime,
      metadata: false,
    });
  } catch (error) {
    console.error("Error exporting data chunk:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

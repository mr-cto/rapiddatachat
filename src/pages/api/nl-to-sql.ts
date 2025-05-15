import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { createNLToSQLService } from "../../../lib/nlToSql";
import {
  handleNLToSQLError,
  formatErrorForResponse,
} from "../../../lib/nlToSql/errorHandling";

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

  // Use a default user email for development
  const userEmail =
    session?.user?.email || (isDevelopment ? "dev@example.com" : "");

  // Use a default user ID for development
  const userSessionId =
    session?.user?.id || (isDevelopment ? "dev-user-id" : "");

  try {
    const {
      query,
      page,
      pageSize,
      sortColumn,
      sortDirection,
      filters,
      userId,
      viewState,
      schemaId,
      fileId,
    } = req.body;

    // Use userId from request body if provided (for testing), otherwise use session email
    const userIdentifier = userId || userEmail;

    console.log(`[API] Processing query for user: ${userIdentifier}`);

    if (schemaId) {
      console.log(`[API] Using global schema with ID: ${schemaId}`);
    }

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Validate pagination parameters
    if (page !== undefined) {
      const pageNum = parseInt(String(page), 10);
      if (isNaN(pageNum) || pageNum < 1) {
        return res
          .status(400)
          .json({ error: "Page must be a positive integer" });
      }
    }

    if (pageSize !== undefined) {
      const pageSizeNum = parseInt(String(pageSize), 10);
      if (isNaN(pageSizeNum) || pageSizeNum < 1) {
        return res
          .status(400)
          .json({ error: "Page size must be a positive integer" });
      }
    }

    // Validate sorting parameters
    if (sortColumn !== undefined && typeof sortColumn !== "string") {
      return res.status(400).json({ error: "Sort column must be a string" });
    }

    if (
      sortDirection !== undefined &&
      !["asc", "desc"].includes(String(sortDirection).toLowerCase())
    ) {
      return res
        .status(400)
        .json({ error: "Sort direction must be 'asc' or 'desc'" });
    }

    // Validate filters
    if (filters !== undefined) {
      try {
        // Ensure filters is a valid object
        JSON.parse(JSON.stringify(filters));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        return res
          .status(400)
          .json({ error: "Filters must be a valid JSON object" });
      }
    }

    // Create the NL-to-SQL service
    const nlToSqlService = createNLToSQLService({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4",
    });

    // Prepare query options
    const queryOptions = {
      page: page ? parseInt(String(page), 10) : undefined,
      pageSize: pageSize ? parseInt(String(pageSize), 10) : undefined,
      sortColumn,
      sortDirection: sortDirection as "asc" | "desc" | undefined,
      filters: filters ? JSON.parse(JSON.stringify(filters)) : undefined,
      viewState,
      schemaId,
      fileId,
    };

    // Process the query with options
    const result = await nlToSqlService.processQuery(
      query,
      userIdentifier,
      queryOptions
    );

    // Convert any BigInt values to strings before serializing to JSON
    const serializedResult = convertBigIntToString(result);

    // Return the result
    return res.status(200).json(serializedResult);
  } catch (error) {
    console.error("Error processing NL-to-SQL query:", error);

    // Use the error handling utility
    const nlToSqlError = handleNLToSQLError(error, "Failed to process query");
    const formattedError = formatErrorForResponse(nlToSqlError);

    return res.status(nlToSqlError.statusCode).json(formattedError);
  }
}

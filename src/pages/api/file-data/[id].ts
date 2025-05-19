import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { getPrismaClient } from "../../../../lib/prisma/replicaClient";
import { executeQuery } from "../../../../lib/database";
import {
  handleFileError,
  ErrorType,
  ErrorSeverity,
} from "../../../../lib/errorHandling";
import { authOptions } from "../../../../lib/authOptions";


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== "GET") {
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

  try {
    const { id } = req.query;
    const fileId = Array.isArray(id) ? id[0] : id;

    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    // Get pagination parameters
    const page = parseInt(
      (Array.isArray(req.query.page) ? req.query.page[0] : req.query.page) ||
        "1",
      10
    );
    const pageSize = parseInt(
      (Array.isArray(req.query.pageSize)
        ? req.query.pageSize[0]
        : req.query.pageSize) || "10",
      10
    );

    // Get sorting parameters
    const sortBy =
      (Array.isArray(req.query.sortBy)
        ? req.query.sortBy[0]
        : req.query.sortBy) || "";
    const sortDirection =
      (Array.isArray(req.query.sortDirection)
        ? req.query.sortDirection[0]
        : req.query.sortDirection) || "asc";

    // Get filter parameters
    const filterColumn =
      (Array.isArray(req.query.filterColumn)
        ? req.query.filterColumn[0]
        : req.query.filterColumn) || "";
    const filterValue =
      (Array.isArray(req.query.filterValue)
        ? req.query.filterValue[0]
        : req.query.filterValue) || "";

    // Validate pagination parameters
    if (isNaN(page) || page < 1) {
      return res.status(400).json({ error: "Invalid page number" });
    }
    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      return res
        .status(400)
        .json({ error: "Invalid page size (must be between 1 and 100)" });
    }

    // Calculate offset
    const offset = (page - 1) * pageSize;

    let file: Record<string, unknown> | null = null;
    let fileData: Array<Record<string, unknown>> = [];
    let totalRows = 0;

    try {
      // Get file information from database to verify ownership
      const fileResult = (await executeQuery(`
        SELECT * FROM files WHERE id = '${fileId}'
      `)) as Array<Record<string, unknown>>;

      // If file doesn't exist
      if (Array.isArray(fileResult) && fileResult.length === 0) {
        return res.status(404).json({ error: "File not found" });
      }

      file = fileResult[0];
      const userId = file.user_id as string;

      // Verify that the file belongs to the current user
      if (userId !== userEmail && !isDevelopment) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Use raw SQL for more complex operations like filtering and sorting JSON data
      try {
        // Get total count with filtering
        let countSql = `SELECT COUNT(*) as count FROM file_data WHERE file_id = '${fileId}'`;

        // Add filtering to count query
        if (filterColumn && filterValue) {
          countSql += ` AND data->>'${filterColumn}' ILIKE '%${filterValue}%'`;
        }

        const countResult = (await executeQuery(countSql)) as Array<{
          count: number;
        }>;
        totalRows = parseInt(countResult[0]?.count?.toString() || "0", 10);

        // Build the data query
        let dataSql = `SELECT data FROM file_data WHERE file_id = '${fileId}'`;

        // Add filtering
        if (filterColumn && filterValue) {
          dataSql += ` AND data->>'${filterColumn}' ILIKE '%${filterValue}%'`;
        }

        // Add sorting
        if (sortBy) {
          const direction =
            sortDirection.toLowerCase() === "desc" ? "DESC" : "ASC";
          dataSql += ` ORDER BY data->>'${sortBy}' ${direction} NULLS LAST`;
        }

        // Add pagination
        dataSql += ` LIMIT ${pageSize} OFFSET ${offset}`;

        // Execute the query
        const dataResult = (await executeQuery(dataSql)) as Array<{
          data: Record<string, unknown>;
        }>;
        fileData = dataResult.map((row) => row.data as Record<string, unknown>);
      } catch (sqlError) {
        console.error("Error executing SQL query:", sqlError);

        // Fallback to basic query without sorting or filtering
        const prisma = getPrismaClient();

        // Get total count without filters
        totalRows = await prisma.fileData.count({
          where: { fileId },
        });

        // Get data without sorting or filtering
        const result = await prisma.fileData.findMany({
          where: { fileId },
          select: { data: true },
          skip: offset,
          take: pageSize,
        });

        fileData = result.map(
          (record: { data: unknown }) => record.data as Record<string, unknown>
        );
      }
    } catch (dbError) {
      // Check if this is a database connection error
      if (
        dbError instanceof Error &&
        dbError.message.includes("Can't reach database server")
      ) {
        console.warn(
          "Database operation skipped: Unable to retrieve file data"
        );

        return res.status(200).json({
          fileId,
          data: [],
          page,
          pageSize,
          totalRows: 0,
          totalPages: 0,
          dbOperationsSkipped: true,
          message:
            "File data is unavailable due to database operations being unavailable",
        });
      } else {
        throw dbError;
      }
    }

    // Calculate total pages
    const totalPages = Math.ceil(totalRows / pageSize);

    // Create response
    const response = {
      fileId,
      data: fileData,
      page,
      pageSize,
      totalRows,
      totalPages,
      sortBy,
      sortDirection,
      filterColumn,
      filterValue,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("File data error:", error);

    // Get fileId from query
    const { id } = req.query;
    const fileId = Array.isArray(id) ? id[0] : id;

    if (fileId) {
      try {
        await handleFileError(
          fileId,
          ErrorType.SYSTEM,
          ErrorSeverity.MEDIUM,
          `Error retrieving file data: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          { error }
        );
      } catch (errorHandlingError) {
        console.error("Error handling failed:", errorHandlingError);
      }
    }

    // Check if this is a database connection error
    if (
      error instanceof Error &&
      error.message.includes("Can't reach database server")
    ) {
      // Return a 200 response with limited data instead of an error
      return res.status(200).json({
        fileId,
        data: [],
        page: 1,
        pageSize: 10,
        totalRows: 0,
        totalPages: 0,
        dbOperationsSkipped: true,
        message:
          "File data is unavailable due to database operations being unavailable",
      });
    }

    return res.status(500).json({
      error: "Failed to retrieve file data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import {
  NormalizedStorageService,
  StorageArchitecturePattern,
  QueryOptions,
} from "../../../lib/dataNormalization/normalizedStorageService";
import { QueryParser } from "../../../lib/queryUtils";
import { executeQuery } from "../../../lib/database";

/**
 * API handler for normalized data
 *
 * GET: Get normalized data for a project
 * POST: Store normalized data
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSession({ req });

  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Create a normalized storage service
    const storageService = new NormalizedStorageService({
      architecturePattern: StorageArchitecturePattern.CENTRALIZED,
      enableVersioning: true,
      enableHistorization: true,
    });

    // Initialize storage
    await storageService.initializeStorage();

    // Handle GET request
    if (req.method === "GET") {
      return handleGetRequest(req, res, storageService);
    }

    // Handle POST request
    if (req.method === "POST") {
      return handlePostRequest(req, res, storageService);
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling normalized data request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Handle GET request
 * @param req Request
 * @param res Response
 * @param storageService Normalized storage service
 */
async function handleGetRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  storageService: NormalizedStorageService
) {
  try {
    const {
      projectId,
      fileId,
      schemaId,
      includeInactive,
      includeHistory,
      version,
      limit,
      offset,
      orderBy,
      orderDirection,
      filters,
    } = req.query;

    // Validate required parameters
    if (!projectId && !fileId) {
      return res
        .status(400)
        .json({ error: "Either projectId or fileId is required" });
    }

    // Parse query parameters using QueryParser
    const queryOptions: QueryOptions = QueryParser.parseQueryParams({
      includeInactive,
      includeHistory,
      version,
      limit,
      offset,
      orderBy,
      orderDirection,
      filters,
    });

    // Get normalized data
    let records;
    if (projectId) {
      records = await storageService.getNormalizedRecords(
        projectId as string,
        queryOptions
      );
    } else {
      records = await storageService.getNormalizedRecordsForFile(
        fileId as string,
        queryOptions
      );
    }

    // Filter by schema if provided
    if (schemaId) {
      records = records.filter((record: any) => record.schemaId === schemaId);
    }

    // Get total count for pagination metadata
    let total = records.length;

    // If limit is specified, we need to get the total count for pagination
    if (queryOptions.limit) {
      // Execute count query to get total records
      const countQuery = projectId
        ? `SELECT COUNT(*) as total FROM normalized_records WHERE project_id = '${projectId}'`
        : `SELECT COUNT(*) as total FROM normalized_records WHERE file_id = '${fileId}'`;

      const countResult = await executeQuery(countQuery);
      total = parseInt(countResult.rows[0].total, 10);
    }

    // Generate pagination metadata
    const paginationMetadata = QueryParser.generatePaginationMetadata(
      total,
      queryOptions.limit,
      queryOptions.offset
    );

    return res.status(200).json({
      records,
      pagination: paginationMetadata,
    });
  } catch (error) {
    console.error("Error handling GET request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Handle POST request
 * @param req Request
 * @param res Response
 * @param storageService Normalized storage service
 */
async function handlePostRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  storageService: NormalizedStorageService
) {
  try {
    const { projectId, fileId, schemaId, data, options } = req.body;

    // Validate required parameters
    if (!projectId || !fileId || !schemaId || !data) {
      return res
        .status(400)
        .json({ error: "projectId, fileId, schemaId, and data are required" });
    }

    // Store normalized data
    const result = await storageService.storeNormalizedData(
      projectId,
      fileId,
      schemaId,
      data,
      options
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error handling POST request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

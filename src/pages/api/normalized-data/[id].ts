import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import {
  NormalizedStorageService,
  StorageArchitecturePattern,
} from "../../../../lib/dataNormalization/normalizedStorageService";

/**
 * API handler for retrieving a specific normalized record by ID
 *
 * GET: Get a normalized record by ID
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
    // Get record ID from the request
    const { id } = req.query;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: "Invalid record ID" });
    }

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
      // Get the record
      const record = await getRecordById(id, req, storageService);

      if (!record) {
        return res.status(404).json({ error: "Record not found" });
      }

      return res.status(200).json({ record });
    }

    // Handle unsupported methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling normalized data request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Get a record by ID
 * @param id Record ID
 * @param req Request
 * @param storageService Normalized storage service
 * @returns Promise<any> Record
 */
async function getRecordById(
  id: string,
  req: NextApiRequest,
  storageService: NormalizedStorageService
): Promise<any> {
  // Get query parameters
  const { includeHistory, version } = req.query;

  // Build query options
  const queryOptions = {
    includeHistory: includeHistory === "true",
    version: version ? parseInt(version as string, 10) : undefined,
  };

  // Execute query to get the record
  const query = `
    SELECT 
      id, 
      project_id as "projectId", 
      file_id as "fileId", 
      schema_id as "schemaId", 
      data, 
      version, 
      created_at as "createdAt", 
      updated_at as "updatedAt", 
      is_active as "isActive", 
      previous_version_id as "previousVersionId", 
      partition_key as "partitionKey", 
      metadata
    FROM normalized_records
    WHERE id = $1
  `;

  // Execute the query
  const result = await executeQuery(query, [id]);

  if (!result || result.rows.length === 0) {
    return null;
  }

  const record = result.rows[0];

  // Get history if requested
  if (queryOptions.includeHistory) {
    const historyQuery = `
      SELECT 
        id, 
        record_id as "recordId", 
        project_id as "projectId", 
        file_id as "fileId", 
        schema_id as "schemaId", 
        data, 
        version, 
        created_at as "createdAt", 
        operation, 
        changed_by as "changedBy", 
        change_reason as "changeReason"
      FROM normalized_record_history
      WHERE record_id = $1
      ORDER BY created_at DESC
    `;

    const historyResult = await executeQuery(historyQuery, [id]);

    if (historyResult && historyResult.rows.length > 0) {
      record.history = historyResult.rows;
    }
  }

  return record;
}

/**
 * Execute a database query
 * @param query Query string
 * @param params Query parameters
 * @returns Promise<any> Query result
 */
async function executeQuery(query: string, params: any[] = []): Promise<any> {
  try {
    // Import the database module dynamically to avoid circular dependencies
    const { executeQuery } = await import("../../../../lib/database");
    return await executeQuery(query, params);
  } catch (error) {
    console.error("Error executing query:", error);
    throw error;
  }
}

import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import {
  NormalizedStorageService,
  StorageArchitecturePattern,
  QueryOptions,
} from "../../../../lib/dataNormalization/normalizedStorageService";

/**
 * API handler for advanced querying of normalized data
 *
 * POST: Execute advanced queries against normalized data
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
    // Only allow POST requests
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Create a normalized storage service
    const storageService = new NormalizedStorageService({
      architecturePattern: StorageArchitecturePattern.CENTRALIZED,
      enableVersioning: true,
      enableHistorization: true,
    });

    // Initialize storage
    await storageService.initializeStorage();

    // Get query parameters from request body
    const {
      projectId,
      fileIds,
      schemaIds,
      filters,
      includeInactive,
      includeHistory,
      version,
      asOfDate,
      limit,
      offset,
      orderBy,
      orderDirection,
      groupBy,
      aggregations,
      joinRelations,
    } = req.body;

    // Validate required parameters
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    // Build query options
    const queryOptions: QueryOptions = {
      includeInactive: includeInactive === true,
      includeHistory: includeHistory === true,
      version: version ? parseInt(version as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
      orderBy: orderBy as string,
      orderDirection: orderDirection as "asc" | "desc",
      filters: filters || {},
    };

    if (asOfDate) {
      queryOptions.asOfDate = new Date(asOfDate);
    }

    // Execute the advanced query
    const result = await executeAdvancedQuery(
      projectId,
      fileIds,
      schemaIds,
      queryOptions,
      groupBy,
      aggregations,
      joinRelations
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error handling advanced query request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Execute an advanced query
 * @param projectId Project ID
 * @param fileIds Optional array of file IDs
 * @param schemaIds Optional array of schema IDs
 * @param queryOptions Query options
 * @param groupBy Optional grouping fields
 * @param aggregations Optional aggregation functions
 * @param joinRelations Optional relations to join
 * @returns Promise<any> Query result
 */
async function executeAdvancedQuery(
  projectId: string,
  fileIds?: string[],
  schemaIds?: string[],
  queryOptions?: QueryOptions,
  groupBy?: string[],
  aggregations?: Array<{
    function: "count" | "sum" | "avg" | "min" | "max";
    field: string;
    alias: string;
  }>,
  joinRelations?: Array<{
    fromSchema: string;
    fromField: string;
    toSchema: string;
    toField: string;
  }>
): Promise<any> {
  try {
    // Start building the query
    let selectClause =
      'SELECT nr.id, nr.project_id as "projectId", nr.file_id as "fileId", ' +
      'nr.schema_id as "schemaId", nr.data, nr.version, ' +
      'nr.created_at as "createdAt", nr.updated_at as "updatedAt", ' +
      'nr.is_active as "isActive"';

    // Add aggregations to select clause if provided
    if (
      aggregations &&
      aggregations.length > 0 &&
      groupBy &&
      groupBy.length > 0
    ) {
      selectClause = "SELECT ";

      // Add group by fields
      for (const field of groupBy) {
        selectClause += `nr.data->>'${field}' as "${field}", `;
      }

      // Add aggregation functions
      for (const agg of aggregations) {
        switch (agg.function) {
          case "count":
            selectClause += `COUNT(*) as "${agg.alias}", `;
            break;
          case "sum":
            selectClause += `SUM((nr.data->>'${agg.field}')::numeric) as "${agg.alias}", `;
            break;
          case "avg":
            selectClause += `AVG((nr.data->>'${agg.field}')::numeric) as "${agg.alias}", `;
            break;
          case "min":
            selectClause += `MIN((nr.data->>'${agg.field}')::numeric) as "${agg.alias}", `;
            break;
          case "max":
            selectClause += `MAX((nr.data->>'${agg.field}')::numeric) as "${agg.alias}", `;
            break;
        }
      }

      // Remove trailing comma and space
      selectClause = selectClause.slice(0, -2);
    }

    // Build from clause
    let fromClause = "FROM normalized_records nr";

    // Add joins if provided
    if (joinRelations && joinRelations.length > 0) {
      let joinIndex = 0;
      for (const join of joinRelations) {
        const alias = `nr${joinIndex + 1}`;
        fromClause += `\nJOIN normalized_records ${alias} ON ${alias}.schema_id = '${join.toSchema}' AND ${alias}.data->>'${join.toField}' = nr.data->>'${join.fromField}'`;
        joinIndex++;
      }
    }

    // Build where clause
    let whereClause = `WHERE nr.project_id = '${projectId}'`;

    // Add file IDs filter
    if (fileIds && fileIds.length > 0) {
      whereClause += ` AND nr.file_id IN ('${fileIds.join("','")}')`;
    }

    // Add schema IDs filter
    if (schemaIds && schemaIds.length > 0) {
      whereClause += ` AND nr.schema_id IN ('${schemaIds.join("','")}')`;
    }

    // Add active filter
    if (!queryOptions?.includeInactive) {
      whereClause += " AND nr.is_active = TRUE";
    }

    // Add version filter
    if (queryOptions?.version) {
      whereClause += ` AND nr.version = ${queryOptions.version}`;
    }

    // Add as-of-date filter
    if (queryOptions?.asOfDate) {
      whereClause += ` AND nr.created_at <= '${queryOptions.asOfDate.toISOString()}'`;
    }

    // Add custom filters
    if (queryOptions?.filters && Object.keys(queryOptions.filters).length > 0) {
      for (const [field, value] of Object.entries(queryOptions.filters)) {
        if (value === null) {
          whereClause += ` AND nr.data->>'${field}' IS NULL`;
        } else if (typeof value === "object" && value !== null) {
          // Handle operator-based filters
          if ("eq" in value) {
            whereClause += ` AND nr.data->>'${field}' = '${value.eq}'`;
          }
          if ("neq" in value) {
            whereClause += ` AND nr.data->>'${field}' != '${value.neq}'`;
          }
          if ("gt" in value) {
            whereClause += ` AND (nr.data->>'${field}')::numeric > ${value.gt}`;
          }
          if ("gte" in value) {
            whereClause += ` AND (nr.data->>'${field}')::numeric >= ${value.gte}`;
          }
          if ("lt" in value) {
            whereClause += ` AND (nr.data->>'${field}')::numeric < ${value.lt}`;
          }
          if ("lte" in value) {
            whereClause += ` AND (nr.data->>'${field}')::numeric <= ${value.lte}`;
          }
          if ("contains" in value) {
            whereClause += ` AND nr.data->>'${field}' LIKE '%${value.contains}%'`;
          }
          if ("startsWith" in value) {
            whereClause += ` AND nr.data->>'${field}' LIKE '${value.startsWith}%'`;
          }
          if ("endsWith" in value) {
            whereClause += ` AND nr.data->>'${field}' LIKE '%${value.endsWith}'`;
          }
          if ("in" in value && Array.isArray(value.in)) {
            whereClause += ` AND nr.data->>'${field}' IN ('${value.in.join(
              "','"
            )}')`;
          }
        } else {
          // Simple equality filter
          whereClause += ` AND nr.data->>'${field}' = '${value}'`;
        }
      }
    }

    // Build group by clause
    let groupByClause = "";
    if (groupBy && groupBy.length > 0) {
      groupByClause =
        "GROUP BY " + groupBy.map((field) => `nr.data->>'${field}'`).join(", ");
    }

    // Build order by clause
    let orderByClause = "";
    if (queryOptions?.orderBy) {
      const direction = queryOptions.orderDirection || "asc";
      orderByClause = `ORDER BY nr.data->>'${
        queryOptions.orderBy
      }' ${direction.toUpperCase()}`;
    } else {
      orderByClause = "ORDER BY nr.created_at DESC";
    }

    // Build limit and offset clause
    let limitOffsetClause = "";
    if (queryOptions?.limit) {
      limitOffsetClause = `LIMIT ${queryOptions.limit}`;
      if (queryOptions.offset) {
        limitOffsetClause += ` OFFSET ${queryOptions.offset}`;
      }
    }

    // Combine all clauses
    const query = `
      ${selectClause}
      ${fromClause}
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      ${limitOffsetClause}
    `;

    // Execute the query
    const { executeQuery } = await import("../../../../lib/database");
    const result = await executeQuery(query);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      ${fromClause}
      ${whereClause}
    `;
    const countResult = await executeQuery(countQuery);
    const total = parseInt(countResult.rows[0].total, 10);

    // Return the result with pagination metadata
    return {
      records: result.rows,
      pagination: {
        total,
        limit: queryOptions?.limit,
        offset: queryOptions?.offset,
        hasMore: queryOptions?.limit
          ? total > (queryOptions.offset || 0) + queryOptions.limit
          : false,
      },
    };
  } catch (error) {
    console.error("Error executing advanced query:", error);
    throw error;
  }
}

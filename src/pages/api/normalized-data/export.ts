import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import {
  NormalizedStorageService,
  StorageArchitecturePattern,
  QueryOptions,
} from "../../../../lib/dataNormalization/normalizedStorageService";

/**
 * API handler for exporting normalized data in various formats
 *
 * POST: Export normalized data in the specified format
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

    // Get export parameters from request body
    const {
      projectId,
      fileIds,
      schemaIds,
      filters,
      includeInactive,
      version,
      format,
      fields,
      fileName,
    } = req.body;

    // Validate required parameters
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    if (!format || !["csv", "json", "excel"].includes(format)) {
      return res
        .status(400)
        .json({ error: "Valid format (csv, json, excel) is required" });
    }

    // Build query options
    const queryOptions: QueryOptions = {
      includeInactive: includeInactive === true,
      includeHistory: false, // Don't include history in exports
      version: version ? parseInt(version as string, 10) : undefined,
      filters: filters || {},
      // No limit for exports - we want all data
    };

    // Get data for export
    const data = await getDataForExport(
      projectId,
      fileIds,
      schemaIds,
      queryOptions,
      fields
    );

    // Set default filename if not provided
    const outputFileName =
      fileName ||
      `export-${projectId}-${new Date().toISOString().slice(0, 10)}`;

    // Export data in the requested format
    switch (format) {
      case "csv":
        return exportAsCsv(res, data, outputFileName);
      case "json":
        return exportAsJson(res, data, outputFileName);
      case "excel":
        return exportAsExcel(res, data, outputFileName);
      default:
        return res.status(400).json({ error: "Unsupported export format" });
    }
  } catch (error) {
    console.error("Error handling export request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Get data for export
 * @param projectId Project ID
 * @param fileIds Optional array of file IDs
 * @param schemaIds Optional array of schema IDs
 * @param queryOptions Query options
 * @param fields Optional fields to include in the export
 * @returns Promise<any[]> Data for export
 */
async function getDataForExport(
  projectId: string,
  fileIds?: string[],
  schemaIds?: string[],
  queryOptions?: QueryOptions,
  fields?: string[]
): Promise<any[]> {
  try {
    // Start building the query
    const selectClause = "SELECT nr.data";

    // Build from clause
    const fromClause = "FROM normalized_records nr";

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

    // Combine all clauses
    const query = `
      ${selectClause}
      ${fromClause}
      ${whereClause}
      ORDER BY nr.created_at DESC
    `;

    // Execute the query
    const { executeQuery } = await import("../../../../lib/database");
    const result = await executeQuery(query);

    // Process the data for export
    const exportData = result.rows.map((row: any) => {
      const data = row.data;

      // Filter fields if specified
      if (fields && fields.length > 0) {
        const filteredData: Record<string, any> = {};
        for (const field of fields) {
          if (field in data) {
            filteredData[field] = data[field];
          }
        }
        return filteredData;
      }

      return data;
    });

    return exportData;
  } catch (error) {
    console.error("Error getting data for export:", error);
    throw error;
  }
}

/**
 * Export data as CSV
 * @param res Response
 * @param data Data to export
 * @param fileName File name
 */
function exportAsCsv(
  res: NextApiResponse,
  data: any[],
  fileName: string
): void {
  try {
    // Get all unique fields from the data
    const allFields = new Set<string>();
    for (const item of data) {
      for (const key of Object.keys(item)) {
        allFields.add(key);
      }
    }
    const fields = Array.from(allFields);

    // Build CSV header
    let csvData = fields.join(",") + "\n";

    // Add data rows
    for (const item of data) {
      const row = fields.map((field) => {
        const value = item[field];
        if (value === null || value === undefined) {
          return "";
        } else if (typeof value === "string") {
          // Escape quotes and wrap in quotes
          return `"${value.replace(/"/g, '""')}"`;
        } else if (typeof value === "object") {
          // Convert objects to JSON strings and escape quotes
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        } else {
          return String(value);
        }
      });
      csvData += row.join(",") + "\n";
    }

    // Set response headers
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}.csv"`
    );

    // Send the CSV data
    res.status(200).send(csvData);
  } catch (error) {
    console.error("Error exporting as CSV:", error);
    res.status(500).json({ error: "Error generating CSV export" });
  }
}

/**
 * Export data as JSON
 * @param res Response
 * @param data Data to export
 * @param fileName File name
 */
function exportAsJson(
  res: NextApiResponse,
  data: any[],
  fileName: string
): void {
  try {
    // Set response headers
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}.json"`
    );

    // Send the JSON data
    res.status(200).json(data);
  } catch (error) {
    console.error("Error exporting as JSON:", error);
    res.status(500).json({ error: "Error generating JSON export" });
  }
}

/**
 * Export data as Excel
 * @param res Response
 * @param data Data to export
 * @param fileName File name
 */
function exportAsExcel(
  res: NextApiResponse,
  data: any[],
  fileName: string
): void {
  try {
    // For simplicity, we'll convert to CSV and just change the content type
    // Get all unique fields from the data
    const allFields = new Set<string>();
    for (const item of data) {
      for (const key of Object.keys(item)) {
        allFields.add(key);
      }
    }
    const fields = Array.from(allFields);

    // Build CSV data (which Excel can open)
    let csvData = fields.join(",") + "\n";

    // Add data rows
    for (const item of data) {
      const row = fields.map((field) => {
        const value = item[field];
        if (value === null || value === undefined) {
          return "";
        } else if (typeof value === "string") {
          // Escape quotes and wrap in quotes
          return `"${value.replace(/"/g, '""')}"`;
        } else if (typeof value === "object") {
          // Convert objects to JSON strings and escape quotes
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        } else {
          return String(value);
        }
      });
      csvData += row.join(",") + "\n";
    }

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}.xlsx"`
    );

    // Send the Excel data
    res.status(200).send(csvData);
  } catch (error) {
    console.error("Error exporting as Excel:", error);
    res.status(500).json({ error: "Error generating Excel export" });
  }
}

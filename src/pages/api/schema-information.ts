import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { executeQuery } from "../../../lib/database";

/**
 * API handler for schema information
 *
 * GET: Get schema information for a project
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  const isDevelopment = process.env.NODE_ENV === "development";

  if ((!session || !session.user) && !isDevelopment) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Only allow GET requests
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Get query parameters
    const { projectId, schemaId } = req.query;

    // Validate required parameters
    if (!projectId && !schemaId) {
      return res
        .status(400)
        .json({ error: "Either projectId or schemaId is required" });
    }

    // If schemaId is provided, get specific schema information
    if (schemaId) {
      const schema = await getSchemaById(schemaId as string);
      if (!schema) {
        return res.status(404).json({ error: "Schema not found" });
      }
      return res.status(200).json(schema);
    }

    // Get all schemas for the project
    const schemas = await getSchemasByProjectId(projectId as string);
    return res.status(200).json(schemas);
  } catch (error) {
    console.error("Error handling schema information request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Get a schema by ID
 * @param schemaId Schema ID
 * @returns Promise<any> Schema
 */
async function getSchemaById(schemaId: string): Promise<any> {
  try {
    // Get schema
    const schemaQuery = `
      SELECT 
        id, 
        name,
        description,
        project_id as "projectId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM global_schemas
      WHERE id = $1
    `;
    const schemaResult = (await executeQuery(schemaQuery, [schemaId])) as any[];

    if (!schemaResult || schemaResult.length === 0) {
      return null;
    }

    const schema = schemaResult[0];

    // Get schema columns
    const columnsQuery = `
      SELECT
        id,
        global_schema_id as "schemaId",
        name,
        description,
        data_type as "type",
        is_required as "isRequired",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM schema_columns
      WHERE global_schema_id = $1
      ORDER BY name ASC
    `;
    const columnsResult = (await executeQuery(columnsQuery, [
      schemaId,
    ])) as any[];

    if (columnsResult && columnsResult.length > 0) {
      schema.columns = columnsResult;
    } else {
      schema.columns = [];
    }

    // Add empty relationships array for compatibility
    schema.relationships = [];

    return schema;
  } catch (error) {
    console.error(`Error getting schema ${schemaId}:`, error);
    throw error;
  }
}

/**
 * Get schemas by project ID
 * @param projectId Project ID
 * @returns Promise<any[]> Schemas
 */
async function getSchemasByProjectId(projectId: string): Promise<any[]> {
  try {
    // Get schemas
    const schemasQuery = `
      SELECT 
        id, 
        name,
        description,
        project_id as "projectId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM global_schemas
      WHERE project_id = $1
      ORDER BY name ASC
    `;
    const schemasResult = (await executeQuery(schemasQuery, [
      projectId,
    ])) as any[];

    if (!schemasResult || schemasResult.length === 0) {
      return [];
    }

    const schemas = schemasResult;

    // Get columns for all schemas
    const columnsQuery = `
      SELECT
        id,
        global_schema_id as "schemaId",
        name,
        description,
        data_type as "type",
        is_required as "isRequired",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM schema_columns
      WHERE global_schema_id IN (
        SELECT id FROM global_schemas WHERE project_id = $1
      )
      ORDER BY global_schema_id, name ASC
    `;
    const columnsResult = (await executeQuery(columnsQuery, [
      projectId,
    ])) as any[];

    // Group columns by schema ID
    const columnsBySchemaId: Record<string, any[]> = {};
    if (columnsResult && columnsResult.length > 0) {
      for (const column of columnsResult) {
        if (!columnsBySchemaId[column.schemaId]) {
          columnsBySchemaId[column.schemaId] = [];
        }
        columnsBySchemaId[column.schemaId].push(column);
      }
    }

    // Add columns to schemas
    for (const schema of schemas) {
      schema.columns = columnsBySchemaId[schema.id] || [];
    }

    // Add empty relationships array for compatibility
    for (const schema of schemas) {
      schema.relationships = [];
    }

    return schemas;
  } catch (error) {
    console.error(`Error getting schemas for project ${projectId}:`, error);
    throw error;
  }
}

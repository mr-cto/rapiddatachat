import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
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
  const session = await getSession({ req });

  if (!session) {
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
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
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
        version, 
        created_at as "createdAt", 
        updated_at as "updatedAt", 
        is_active as "isActive"
      FROM global_schemas
      WHERE id = $1
    `;
    const schemaResult = await executeQuery(schemaQuery, [schemaId]);

    if (!schemaResult || schemaResult.rows.length === 0) {
      return null;
    }

    const schema = schemaResult.rows[0];

    // Get schema columns
    const columnsQuery = `
      SELECT 
        id, 
        schema_id as "schemaId", 
        name, 
        description, 
        type, 
        is_required as "isRequired", 
        is_unique as "isUnique", 
        default_value as "defaultValue", 
        validation_rules as "validationRules", 
        created_at as "createdAt", 
        updated_at as "updatedAt", 
        is_active as "isActive",
        display_order as "displayOrder"
      FROM global_schema_columns
      WHERE schema_id = $1
      ORDER BY display_order ASC, name ASC
    `;
    const columnsResult = await executeQuery(columnsQuery, [schemaId]);

    if (columnsResult && columnsResult.rows.length > 0) {
      schema.columns = columnsResult.rows;
    } else {
      schema.columns = [];
    }

    // Get schema relationships
    const relationshipsQuery = `
      SELECT 
        id, 
        from_schema_id as "fromSchemaId", 
        from_column_id as "fromColumnId", 
        to_schema_id as "toSchemaId", 
        to_column_id as "toColumnId", 
        relationship_type as "relationshipType", 
        created_at as "createdAt", 
        updated_at as "updatedAt", 
        is_active as "isActive"
      FROM schema_relationships
      WHERE from_schema_id = $1 OR to_schema_id = $1
    `;
    const relationshipsResult = await executeQuery(relationshipsQuery, [
      schemaId,
    ]);

    if (relationshipsResult && relationshipsResult.rows.length > 0) {
      schema.relationships = relationshipsResult.rows;
    } else {
      schema.relationships = [];
    }

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
        version, 
        created_at as "createdAt", 
        updated_at as "updatedAt", 
        is_active as "isActive"
      FROM global_schemas
      WHERE project_id = $1
      ORDER BY name ASC
    `;
    const schemasResult = await executeQuery(schemasQuery, [projectId]);

    if (!schemasResult || schemasResult.rows.length === 0) {
      return [];
    }

    const schemas = schemasResult.rows;

    // Get columns for all schemas
    const columnsQuery = `
      SELECT 
        id, 
        schema_id as "schemaId", 
        name, 
        description, 
        type, 
        is_required as "isRequired", 
        is_unique as "isUnique", 
        default_value as "defaultValue", 
        validation_rules as "validationRules", 
        created_at as "createdAt", 
        updated_at as "updatedAt", 
        is_active as "isActive",
        display_order as "displayOrder"
      FROM global_schema_columns
      WHERE schema_id IN (
        SELECT id FROM global_schemas WHERE project_id = $1
      )
      ORDER BY schema_id, display_order ASC, name ASC
    `;
    const columnsResult = await executeQuery(columnsQuery, [projectId]);

    // Group columns by schema ID
    const columnsBySchemaId: Record<string, any[]> = {};
    if (columnsResult && columnsResult.rows.length > 0) {
      for (const column of columnsResult.rows) {
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

    // Get relationships for all schemas
    const relationshipsQuery = `
      SELECT 
        id, 
        from_schema_id as "fromSchemaId", 
        from_column_id as "fromColumnId", 
        to_schema_id as "toSchemaId", 
        to_column_id as "toColumnId", 
        relationship_type as "relationshipType", 
        created_at as "createdAt", 
        updated_at as "updatedAt", 
        is_active as "isActive"
      FROM schema_relationships
      WHERE from_schema_id IN (
        SELECT id FROM global_schemas WHERE project_id = $1
      ) OR to_schema_id IN (
        SELECT id FROM global_schemas WHERE project_id = $1
      )
    `;
    const relationshipsResult = await executeQuery(relationshipsQuery, [
      projectId,
    ]);

    // Group relationships by schema ID
    const relationshipsBySchemaId: Record<string, any[]> = {};
    if (relationshipsResult && relationshipsResult.rows.length > 0) {
      for (const relationship of relationshipsResult.rows) {
        // Add to from schema
        if (!relationshipsBySchemaId[relationship.fromSchemaId]) {
          relationshipsBySchemaId[relationship.fromSchemaId] = [];
        }
        relationshipsBySchemaId[relationship.fromSchemaId].push({
          ...relationship,
          direction: "outgoing",
        });

        // Add to to schema
        if (!relationshipsBySchemaId[relationship.toSchemaId]) {
          relationshipsBySchemaId[relationship.toSchemaId] = [];
        }
        relationshipsBySchemaId[relationship.toSchemaId].push({
          ...relationship,
          direction: "incoming",
        });
      }
    }

    // Add relationships to schemas
    for (const schema of schemas) {
      schema.relationships = relationshipsBySchemaId[schema.id] || [];
    }

    return schemas;
  } catch (error) {
    console.error(`Error getting schemas for project ${projectId}:`, error);
    throw error;
  }
}

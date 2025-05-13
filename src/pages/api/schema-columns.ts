import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { GlobalSchemaService } from "../../../lib/globalSchemaService";
import { v4 as uuidv4 } from "uuid";

/**
 * API handler for schema column operations
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check authentication
  const session = await getServerSession(req, res, authOptions);

  // Require authentication for all requests
  if (!session || !session.user || !session.user.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Use user email for compatibility with existing data
  // If email is not available, fall back to the user ID
  const userId = session.user.email || session.user.id || "";
  const globalSchemaService = new GlobalSchemaService();

  try {
    // Handle different HTTP methods
    switch (req.method) {
      case "GET":
        return await handleGetRequest(req, res, globalSchemaService);

      case "POST":
        return await handlePostRequest(req, res, userId, globalSchemaService);

      case "PUT":
        return await handlePutRequest(req, res, userId, globalSchemaService);

      case "DELETE":
        return await handleDeleteRequest(req, res, userId, globalSchemaService);

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error in schema-columns API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle GET requests
 */
async function handleGetRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  globalSchemaService: GlobalSchemaService
) {
  const { schemaId, columnId } = req.query;

  // Validate required parameters
  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  // Get schema
  const schema = await globalSchemaService.getGlobalSchemaById(
    schemaId as string
  );

  if (!schema) {
    return res.status(404).json({ error: "Schema not found" });
  }

  // If columnId is provided, return specific column
  if (columnId) {
    const column = schema.columns.find((c) => c.id === columnId);

    if (!column) {
      return res.status(404).json({ error: "Column not found" });
    }

    return res.status(200).json({ column });
  }

  // Otherwise, return all columns
  return res.status(200).json({ columns: schema.columns });
}

/**
 * Handle POST requests
 */
async function handlePostRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  globalSchemaService: GlobalSchemaService
) {
  const { schemaId, column } = req.body;

  // Validate required parameters
  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  if (!column) {
    return res.status(400).json({ error: "Column is required" });
  }

  if (!column.name) {
    return res.status(400).json({ error: "Column name is required" });
  }

  if (!column.type) {
    return res.status(400).json({ error: "Column type is required" });
  }

  // Get schema
  const schema = await globalSchemaService.getGlobalSchemaById(schemaId);

  if (!schema) {
    return res.status(404).json({ error: "Schema not found" });
  }

  // Check if the user owns the schema
  if (schema.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Check if column name already exists
  const existingColumn = schema.columns.find((c) => c.name === column.name);

  if (existingColumn) {
    return res.status(400).json({ error: "Column name already exists" });
  }

  // Generate column ID if not provided
  const columnId = column.id || `col_${uuidv4()}`;
  const newColumn = {
    ...column,
    id: columnId,
  };

  // Add column to schema
  schema.columns.push(newColumn);

  // Update schema
  await globalSchemaService.updateGlobalSchema(schema);

  // Return success
  return res.status(201).json({
    success: true,
    columnId,
    message: "Column added successfully",
  });
}

/**
 * Handle PUT requests
 */
async function handlePutRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  globalSchemaService: GlobalSchemaService
) {
  const { schemaId, columnId, column } = req.body;

  // Validate required parameters
  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  if (!columnId) {
    return res.status(400).json({ error: "Column ID is required" });
  }

  if (!column) {
    return res.status(400).json({ error: "Column is required" });
  }

  // Get schema
  const schema = await globalSchemaService.getGlobalSchemaById(schemaId);

  if (!schema) {
    return res.status(404).json({ error: "Schema not found" });
  }

  // Check if the user owns the schema
  if (schema.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Find column index
  const columnIndex = schema.columns.findIndex((c) => c.id === columnId);

  if (columnIndex === -1) {
    return res.status(404).json({ error: "Column not found" });
  }

  // Check if column name already exists (if name is being changed)
  if (column.name !== schema.columns[columnIndex].name) {
    const existingColumn = schema.columns.find((c) => c.name === column.name);

    if (existingColumn) {
      return res.status(400).json({ error: "Column name already exists" });
    }
  }

  // Update column
  schema.columns[columnIndex] = {
    ...schema.columns[columnIndex],
    ...column,
    id: columnId, // Ensure ID doesn't change
  };

  // Update schema
  await globalSchemaService.updateGlobalSchema(schema);

  // Return success
  return res.status(200).json({
    success: true,
    message: "Column updated successfully",
  });
}

/**
 * Handle DELETE requests
 */
async function handleDeleteRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  globalSchemaService: GlobalSchemaService
) {
  const { schemaId, columnId } = req.query;

  // Validate required parameters
  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  if (!columnId) {
    return res.status(400).json({ error: "Column ID is required" });
  }

  // Get schema
  const schema = await globalSchemaService.getGlobalSchemaById(
    schemaId as string
  );

  if (!schema) {
    return res.status(404).json({ error: "Schema not found" });
  }

  // Check if the user owns the schema
  if (schema.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Find column index
  const columnIndex = schema.columns.findIndex((c) => c.id === columnId);

  if (columnIndex === -1) {
    return res.status(404).json({ error: "Column not found" });
  }

  // Remove column
  schema.columns.splice(columnIndex, 1);

  // Update schema
  await globalSchemaService.updateGlobalSchema(schema);

  // Return success
  return res.status(200).json({
    success: true,
    message: "Column deleted successfully",
  });
}

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import {
  ColumnMappingService,
  ColumnMapping,
} from "../../../lib/columnMappingService";
import { GlobalSchemaService } from "../../../lib/globalSchemaService";

/**
 * API handler for column mapping operations
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
  const columnMappingService = new ColumnMappingService();
  const globalSchemaService = new GlobalSchemaService();

  try {
    // Handle different HTTP methods
    switch (req.method) {
      case "GET":
        return await handleGetRequest(
          req,
          res,
          columnMappingService,
          globalSchemaService
        );

      case "POST":
        return await handlePostRequest(
          req,
          res,
          userId,
          columnMappingService,
          globalSchemaService
        );

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error in column-mapping API:", error);
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
  columnMappingService: ColumnMappingService,
  globalSchemaService: GlobalSchemaService
) {
  const { fileId, schemaId, action } = req.query;

  // Validate required parameters
  if (!fileId) {
    return res.status(400).json({ error: "File ID is required" });
  }

  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  // Handle different actions
  switch (action) {
    case "file-columns":
      // Get file columns
      const fileColumns = await columnMappingService.getFileColumns(
        fileId as string
      );
      return res.status(200).json({ fileColumns });

    case "schema-columns":
      // Get schema columns
      const schemaColumns = await columnMappingService.getSchemaColumns(
        schemaId as string
      );
      return res.status(200).json({ schemaColumns });

    case "mappings":
      // Get existing mappings
      const mappings = await columnMappingService.getMappings(
        fileId as string,
        schemaId as string
      );
      return res.status(200).json({ mappings });

    case "suggestions":
      // Get file and schema columns
      const fileColumnsForSuggestions =
        await columnMappingService.getFileColumns(fileId as string);
      const schemaColumnsForSuggestions =
        await columnMappingService.getSchemaColumns(schemaId as string);

      // Get mapping suggestions
      const suggestions = await columnMappingService.suggestMappings(
        fileColumnsForSuggestions,
        schemaColumnsForSuggestions
      );
      return res.status(200).json(suggestions);

    default:
      // Default action: get all data
      const fileColumnsData = await columnMappingService.getFileColumns(
        fileId as string
      );
      const schemaColumnsData = await columnMappingService.getSchemaColumns(
        schemaId as string
      );
      const mappingsData = await columnMappingService.getMappings(
        fileId as string,
        schemaId as string
      );
      const suggestionsData = await columnMappingService.suggestMappings(
        fileColumnsData,
        schemaColumnsData
      );

      return res.status(200).json({
        fileColumns: fileColumnsData,
        schemaColumns: schemaColumnsData,
        mappings: mappingsData,
        suggestions: suggestionsData.suggestions,
        confidence: suggestionsData.confidence,
        reason: suggestionsData.reason,
      });
  }
}

/**
 * Handle POST requests
 */
async function handlePostRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  columnMappingService: ColumnMappingService,
  globalSchemaService: GlobalSchemaService
) {
  const { fileId, schemaId, action } = req.body;

  // Validate required parameters
  if (!fileId) {
    return res.status(400).json({ error: "File ID is required" });
  }

  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  // Check if the schema exists
  const schema = await globalSchemaService.getGlobalSchemaById(schemaId);

  if (!schema) {
    return res.status(404).json({ error: "Schema not found" });
  }

  // Handle different actions
  switch (action) {
    case "save-mappings":
      // Validate mappings
      if (!req.body.mappings || !Array.isArray(req.body.mappings)) {
        return res.status(400).json({ error: "Mappings are required" });
      }

      // Save mappings
      const success = await columnMappingService.saveMappings(
        fileId,
        schemaId,
        req.body.mappings as ColumnMapping[]
      );

      return res.status(200).json({ success });

    case "apply-mappings":
      // Validate data
      if (!req.body.data || !Array.isArray(req.body.data)) {
        return res.status(400).json({ error: "Data is required" });
      }

      // Get mappings
      const mappings = req.body.mappings
        ? (req.body.mappings as ColumnMapping[])
        : await columnMappingService.getMappings(fileId, schemaId);

      // Get schema columns
      const schemaColumns = await columnMappingService.getSchemaColumns(
        schemaId
      );

      // Apply mappings
      const mappedData = await columnMappingService.applyMappings(
        req.body.data,
        mappings,
        schemaColumns
      );

      return res.status(200).json({ mappedData });

    case "auto-map":
      // Get file and schema columns
      const fileColumns = await columnMappingService.getFileColumns(fileId);
      const schemaColumnsForAutoMap =
        await columnMappingService.getSchemaColumns(schemaId);

      // Get mapping suggestions
      const suggestions = await columnMappingService.suggestMappings(
        fileColumns,
        schemaColumnsForAutoMap
      );

      // Convert suggestions to mappings
      const autoMappings: ColumnMapping[] = [];
      Object.entries(suggestions.suggestions).forEach(
        ([fileColumnName, schemaColumnId]) => {
          autoMappings.push({
            fileColumnName,
            schemaColumnId,
          });
        }
      );

      // Save mappings
      const autoMapSuccess = await columnMappingService.saveMappings(
        fileId,
        schemaId,
        autoMappings
      );

      return res.status(200).json({
        success: autoMapSuccess,
        mappings: autoMappings,
        suggestions: suggestions.suggestions,
        confidence: suggestions.confidence,
        reason: suggestions.reason,
      });

    default:
      return res.status(400).json({ error: "Invalid action" });
  }
}

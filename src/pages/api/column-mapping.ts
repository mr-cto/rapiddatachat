import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import {
  ColumnMappingService,
  ColumnMapping,
} from "../../../lib/columnMappingService";
import { GlobalSchemaService } from "../../../lib/globalSchemaService";
import { TransformationRule } from "../../../components/schema/TransformationRuleForm";
import transformationService from "../../../lib/transformationService";

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

    case "transformation-rules":
      // Get transformation rules
      const transformationRules = await getTransformationRules(
        fileId as string,
        schemaId as string
      );
      return res.status(200).json({ transformationRules });

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
      const transformationRulesData = await getTransformationRules(
        fileId as string,
        schemaId as string
      );

      return res.status(200).json({
        fileColumns: fileColumnsData,
        schemaColumns: schemaColumnsData,
        mappings: mappingsData,
        suggestions: suggestionsData.suggestions,
        confidence: suggestionsData.confidence,
        reason: suggestionsData.reason,
        transformationRules: transformationRulesData,
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

      // Save transformation rules if provided
      if (req.body.transformationRules) {
        await saveTransformationRules(
          fileId,
          schemaId,
          req.body.transformationRules as Record<string, TransformationRule[]>
        );
      }

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

      // Get transformation rules
      const transformationRules = req.body.transformationRules
        ? (req.body.transformationRules as Record<string, TransformationRule[]>)
        : await getTransformationRules(fileId, schemaId);

      // Apply mappings and transformations
      const mappedData = await applyMappingsWithTransformations(
        req.body.data,
        mappings,
        schemaColumns,
        transformationRules
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

    case "save-transformation-rules":
      // Validate transformation rules
      if (!req.body.transformationRules) {
        return res
          .status(400)
          .json({ error: "Transformation rules are required" });
      }

      // Save transformation rules
      const saveRulesSuccess = await saveTransformationRules(
        fileId,
        schemaId,
        req.body.transformationRules as Record<string, TransformationRule[]>
      );

      return res.status(200).json({ success: saveRulesSuccess });

    default:
      return res.status(400).json({ error: "Invalid action" });
  }
}

/**
 * Get transformation rules for a file and schema
 * @param fileId File ID
 * @param schemaId Schema ID
 * @returns Promise<Record<string, TransformationRule[]>> Transformation rules
 */
async function getTransformationRules(
  fileId: string,
  schemaId: string
): Promise<Record<string, TransformationRule[]>> {
  try {
    // Check if the transformation_rules table exists
    const tableExists = await checkIfTableExists("transformation_rules");

    if (!tableExists) {
      return {};
    }

    // Get transformation rules
    const result = (await executeQuery(`
      SELECT rules
      FROM transformation_rules
      WHERE file_id = '${fileId}' AND schema_id = '${schemaId}'
    `)) as Array<{
      rules: string;
    }>;

    if (!result || result.length === 0) {
      return {};
    }

    // Parse rules
    let rules: Record<string, TransformationRule[]> = {};
    try {
      if (result[0].rules) {
        if (typeof result[0].rules === "string") {
          rules = JSON.parse(result[0].rules);
        } else if (typeof result[0].rules === "object") {
          rules = result[0].rules as Record<string, TransformationRule[]>;
        }
      }
    } catch (parseError) {
      console.error(
        `[column-mapping] Error parsing transformation rules for file ${fileId} and schema ${schemaId}:`,
        parseError
      );
      rules = {};
    }

    return rules;
  } catch (error) {
    console.error(
      `[column-mapping] Error getting transformation rules for file ${fileId} and schema ${schemaId}:`,
      error
    );
    return {};
  }
}

/**
 * Save transformation rules for a file and schema
 * @param fileId File ID
 * @param schemaId Schema ID
 * @param rules Transformation rules
 * @returns Promise<boolean> Success
 */
async function saveTransformationRules(
  fileId: string,
  schemaId: string,
  rules: Record<string, TransformationRule[]>
): Promise<boolean> {
  try {
    // Check if the transformation_rules table exists
    const tableExists = await checkIfTableExists("transformation_rules");

    if (!tableExists) {
      // Create the table if it doesn't exist
      await executeQuery(`
        CREATE TABLE transformation_rules (
          id TEXT PRIMARY KEY,
          file_id TEXT NOT NULL,
          schema_id TEXT NOT NULL,
          rules JSONB NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // Check if rules already exist for this file and schema
    const existingResult = (await executeQuery(`
      SELECT id
      FROM transformation_rules
      WHERE file_id = '${fileId}' AND schema_id = '${schemaId}'
    `)) as Array<{
      id: string;
    }>;

    const ruleId =
      existingResult && existingResult.length > 0
        ? existingResult[0].id
        : `rule_${Date.now()}`;

    // Save rules
    if (existingResult && existingResult.length > 0) {
      // Update existing rules
      await executeQuery(`
        UPDATE transformation_rules
        SET 
          rules = '${JSON.stringify(rules)}',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = '${ruleId}'
      `);
    } else {
      // Insert new rules
      await executeQuery(`
        INSERT INTO transformation_rules (
          id,
          file_id,
          schema_id,
          rules,
          created_at,
          updated_at
        )
        VALUES (
          '${ruleId}',
          '${fileId}',
          '${schemaId}',
          '${JSON.stringify(rules)}',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `);
    }

    return true;
  } catch (error) {
    console.error(
      `[column-mapping] Error saving transformation rules for file ${fileId} and schema ${schemaId}:`,
      error
    );
    return false;
  }
}

/**
 * Apply mappings and transformations to data
 * @param data Data to map
 * @param mappings Column mappings
 * @param schemaColumns Schema columns
 * @param transformationRules Transformation rules
 * @returns Promise<any[]> Mapped data
 */
async function applyMappingsWithTransformations(
  data: any[],
  mappings: ColumnMapping[],
  schemaColumns: any[],
  transformationRules: Record<string, TransformationRule[]>
): Promise<any[]> {
  try {
    return data.map((row) => {
      const mappedRow: Record<string, any> = {};
      mappings.forEach((mapping) => {
        const schemaColumn = schemaColumns.find(
          (sc) => sc.id === mapping.schemaColumnId
        );
        if (schemaColumn) {
          let value = row[mapping.fileColumnName];

          // Apply transformation rules if any
          const rules = transformationRules[mapping.fileColumnName];
          if (rules && rules.length > 0) {
            value = transformationService.applyTransformations(value, rules);
          }

          mappedRow[schemaColumn.name] = value;
        }
      });
      return mappedRow;
    });
  } catch (error) {
    console.error(
      `[column-mapping] Error applying mappings with transformations:`,
      error
    );
    throw error;
  }
}

/**
 * Check if a table exists
 * @param tableName Table name
 * @returns Promise<boolean> True if the table exists
 */
async function checkIfTableExists(tableName: string): Promise<boolean> {
  try {
    // Use dynamic import instead of require
    const database = await import("../../../lib/database");
    const { executeQuery: dbExecuteQuery } = database;
    const result = (await dbExecuteQuery(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = '${tableName}'
      ) as exists
    `)) as Array<{ exists: boolean }>;

    return result && result.length > 0 && result[0].exists;
  } catch (error) {
    console.error(
      `[column-mapping] Error checking if table ${tableName} exists:`,
      error
    );
    return false;
  }
}

/**
 * Execute a query
 * @param query Query to execute
 * @returns Promise<any> Query result
 */
async function executeQuery(query: string): Promise<any> {
  // Use dynamic import instead of require
  const database = await import("../../../lib/database");
  const { executeQuery: dbExecuteQuery } = database;
  return dbExecuteQuery(query);
}

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import {
  DataNormalizationService,
  ValidationOptions,
} from "../../../lib/dataNormalization/dataNormalizationService";
import { GlobalSchemaService } from "../../../lib/globalSchemaService";

/**
 * API handler for data normalization operations
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
  const dataNormalizationService = new DataNormalizationService();
  const globalSchemaService = new GlobalSchemaService();

  try {
    // Handle different HTTP methods
    switch (req.method) {
      case "POST":
        return await handleNormalizeData(
          req,
          res,
          userId,
          dataNormalizationService,
          globalSchemaService
        );

      case "GET":
        return await handleGetNormalizedData(
          req,
          res,
          userId,
          dataNormalizationService
        );

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error in data-normalization API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle POST requests for normalizing data
 */
async function handleNormalizeData(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  dataNormalizationService: DataNormalizationService,
  globalSchemaService: GlobalSchemaService
) {
  const { fileId, projectId, schemaId, rawData, options } = req.body;

  // Validate required parameters
  if (!fileId) {
    return res.status(400).json({ error: "File ID is required" });
  }

  if (!projectId) {
    return res.status(400).json({ error: "Project ID is required" });
  }

  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  if (!rawData || !Array.isArray(rawData)) {
    return res.status(400).json({ error: "Raw data must be an array" });
  }

  // Get the column mapping
  const columnMapping = await globalSchemaService.getColumnMapping(
    fileId,
    schemaId
  );

  if (!columnMapping) {
    return res.status(404).json({ error: "Column mapping not found" });
  }

  // Parse validation options
  const validationOptions: ValidationOptions = {
    skipInvalidRows: options?.skipInvalidRows ?? false,
    validateTypes: options?.validateTypes ?? true,
    validateRequired: options?.validateRequired ?? true,
    validateConstraints: options?.validateConstraints ?? true,
  };

  // Normalize and store the data
  const result = await dataNormalizationService.normalizeAndStoreData(
    fileId,
    projectId,
    rawData,
    columnMapping,
    validationOptions
  );

  return res.status(200).json(result);
}

/**
 * Handle GET requests for retrieving normalized data
 */
async function handleGetNormalizedData(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  dataNormalizationService: DataNormalizationService
) {
  const { fileId, projectId, schemaId } = req.query;

  // If fileId is provided, get normalized data for the file
  if (fileId) {
    const normalizedData =
      await dataNormalizationService.getNormalizedDataForFile(fileId as string);

    return res.status(200).json({ normalizedData });
  }
  // If projectId is provided, get normalized data for the project
  else if (projectId) {
    const normalizedData = await dataNormalizationService.getNormalizedData(
      projectId as string,
      schemaId as string | undefined
    );

    return res.status(200).json({ normalizedData });
  }
  // Otherwise, return an error
  else {
    return res.status(400).json({ error: "File ID or project ID is required" });
  }
}

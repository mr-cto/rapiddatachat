import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import mappingEngine, {
  MappingDefinition,
} from "../../../../lib/dataTransformation/mappingEngine";
import { authOptions } from "../../../../lib/authOptions";

/**
 * API handler for mapping definitions
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Use user email for compatibility with existing data
  // If email is not available, fall back to the user ID
  const userId = session.user.email || session.user.id || "";

  try {
    // Handle different HTTP methods
    switch (req.method) {
      case "GET":
        return await handleGetRequest(req, res, userId);
      case "POST":
        return await handlePostRequest(req, res, userId);
      case "PUT":
        return await handlePutRequest(req, res, userId);
      case "DELETE":
        return await handleDeleteRequest(req, res, userId);
      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error in mapping-definitions API:", error);
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
  userId: string
) {
  const { id, projectId } = req.query;

  // Get mapping definition by ID
  if (id) {
    const definition = await mappingEngine.getMappingDefinition(id as string);

    if (!definition) {
      return res.status(404).json({ error: "Mapping definition not found" });
    }

    // Check if the user owns the mapping definition
    if (definition.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.status(200).json(definition);
  }

  // Get mapping definitions for a project
  if (projectId) {
    const definitions = await mappingEngine.getMappingDefinitionsForProject(
      projectId as string
    );
    return res.status(200).json(definitions);
  }

  // No ID or project ID provided
  return res.status(400).json({ error: "ID or project ID is required" });
}

/**
 * Handle POST requests
 */
async function handlePostRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const {
    name,
    description,
    sourceType,
    targetType,
    mappings,
    transformationRules,
    projectId,
  } = req.body;

  // Validate required parameters
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  if (!sourceType) {
    return res.status(400).json({ error: "Source type is required" });
  }

  if (!targetType) {
    return res.status(400).json({ error: "Target type is required" });
  }

  if (!mappings || !Array.isArray(mappings)) {
    return res.status(400).json({ error: "Mappings are required" });
  }

  if (!projectId) {
    return res.status(400).json({ error: "Project ID is required" });
  }

  // Create mapping definition
  const definition = await mappingEngine.saveMappingDefinition({
    name,
    description,
    sourceType,
    targetType,
    mappings,
    transformationRules,
    userId,
    projectId,
  });

  return res.status(201).json(definition);
}

/**
 * Handle PUT requests
 */
async function handlePutRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const {
    id,
    name,
    description,
    sourceType,
    targetType,
    mappings,
    transformationRules,
  } = req.body;

  // Validate required parameters
  if (!id) {
    return res.status(400).json({ error: "ID is required" });
  }

  // Get existing mapping definition
  const existingDefinition = await mappingEngine.getMappingDefinition(id);

  if (!existingDefinition) {
    return res.status(404).json({ error: "Mapping definition not found" });
  }

  // Check if the user owns the mapping definition
  if (existingDefinition.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Update mapping definition
  const updatedDefinition = await mappingEngine.updateMappingDefinition(id, {
    name,
    description,
    sourceType,
    targetType,
    mappings,
    transformationRules,
  });

  if (!updatedDefinition) {
    return res
      .status(500)
      .json({ error: "Failed to update mapping definition" });
  }

  return res.status(200).json(updatedDefinition);
}

/**
 * Handle DELETE requests
 */
async function handleDeleteRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const { id } = req.query;

  // Validate required parameters
  if (!id) {
    return res.status(400).json({ error: "ID is required" });
  }

  // Get existing mapping definition
  const existingDefinition = await mappingEngine.getMappingDefinition(
    id as string
  );

  if (!existingDefinition) {
    return res.status(404).json({ error: "Mapping definition not found" });
  }

  // Check if the user owns the mapping definition
  if (existingDefinition.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Delete mapping definition
  const success = await mappingEngine.deleteMappingDefinition(id as string);

  if (!success) {
    return res
      .status(500)
      .json({ error: "Failed to delete mapping definition" });
  }

  return res.status(200).json({ success: true });
}

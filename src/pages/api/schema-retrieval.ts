import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import {
  GlobalSchema,
  GlobalSchemaService,
} from "../../../lib/globalSchemaService";
import { schemaCache } from "../../../lib/schemaCacheService";

/**
 * API handler for schema retrieval operations
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
  const schemaService = new GlobalSchemaService();

  try {
    // Handle different HTTP methods
    switch (req.method) {
      case "GET":
        return await handleGetSchema(req, res, userId, schemaService);

      case "POST":
        return await handleGetMultipleSchemas(req, res, userId, schemaService);

      case "DELETE":
        return await handleClearCache(req, res, userId);

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error in schema-retrieval API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle GET requests for schema retrieval
 */
async function handleGetSchema(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  schemaService: GlobalSchemaService
) {
  const { id, projectId, bypassCache } = req.query;

  // If id is provided, get a specific schema
  if (id) {
    const schemaId = id as string;

    // Check if we should bypass the cache
    const shouldBypassCache = bypassCache === "true";

    // Try to get the schema from the cache first
    let schema = shouldBypassCache ? null : schemaCache.getSchema(schemaId);

    // If not in cache or bypass cache, get from database
    if (!schema) {
      schema = await schemaService.getGlobalSchemaById(schemaId);

      // If found, cache it for future requests
      if (schema && !shouldBypassCache) {
        schemaCache.setSchema(schemaId, schema);
      }
    }

    if (!schema) {
      return res.status(404).json({ error: "Schema not found" });
    }

    // Check if the schema belongs to the user
    if (schema.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.status(200).json({
      schema,
      fromCache:
        !shouldBypassCache &&
        schemaCache.has(schemaCache.getSchemaKey(schemaId)),
    });
  }
  // If projectId is provided, get all schemas for a project
  else if (projectId) {
    const cacheKey = `schemas:project:${projectId}`;
    const shouldBypassCache = bypassCache === "true";

    // Try to get the schemas from the cache first
    let schemas = shouldBypassCache
      ? null
      : schemaCache.get<GlobalSchema[]>(cacheKey);

    // If not in cache or bypass cache, get from database
    if (!schemas) {
      schemas = await schemaService.getGlobalSchemas(
        userId,
        projectId as string
      );

      // If found, cache it for future requests
      if (schemas && !shouldBypassCache) {
        schemaCache.set(cacheKey, schemas, 60); // Cache for 1 minute
      }
    }

    return res.status(200).json({
      schemas,
      fromCache: !shouldBypassCache && schemaCache.has(cacheKey),
    });
  }
  // Otherwise, get all schemas for the user
  else {
    const cacheKey = `schemas:user:${userId}`;
    const shouldBypassCache = bypassCache === "true";

    // Try to get the schemas from the cache first
    let schemas = shouldBypassCache
      ? null
      : schemaCache.get<GlobalSchema[]>(cacheKey);

    // If not in cache or bypass cache, get from database
    if (!schemas) {
      schemas = await schemaService.getGlobalSchemas(userId);

      // If found, cache it for future requests
      if (schemas && !shouldBypassCache) {
        schemaCache.set(cacheKey, schemas, 60); // Cache for 1 minute
      }
    }

    return res.status(200).json({
      schemas,
      fromCache: !shouldBypassCache && schemaCache.has(cacheKey),
    });
  }
}

/**
 * Handle POST requests for retrieving multiple schemas
 */
async function handleGetMultipleSchemas(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  schemaService: GlobalSchemaService
) {
  const { ids, bypassCache } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Schema IDs are required" });
  }

  const shouldBypassCache = bypassCache === true;
  const schemaIds = ids as string[];
  const schemas: GlobalSchema[] = [];
  const missingIds: string[] = [];

  // Try to get schemas from cache first
  const cachedSchemas = shouldBypassCache
    ? {}
    : schemaCache.getMulti<GlobalSchema>(
        schemaIds.map((id) => schemaCache.getSchemaKey(id))
      );

  // Process each schema ID
  for (const schemaId of schemaIds) {
    // Check if we have it in the cache
    const cacheKey = schemaCache.getSchemaKey(schemaId);
    let schema = shouldBypassCache
      ? null
      : (cachedSchemas[cacheKey] as GlobalSchema | undefined);

    // If not in cache or bypass cache, get from database
    if (!schema) {
      schema = await schemaService.getGlobalSchemaById(schemaId);

      // If found, cache it for future requests
      if (schema && !shouldBypassCache) {
        schemaCache.setSchema(schemaId, schema);
      }
    }

    if (schema) {
      // Check if the schema belongs to the user
      if (schema.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      schemas.push(schema);
    } else {
      missingIds.push(schemaId);
    }
  }

  return res.status(200).json({
    schemas,
    missingIds,
    fromCache: !shouldBypassCache,
  });
}

/**
 * Handle DELETE requests for clearing the cache
 */
async function handleClearCache(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const { id, all } = req.query;

  // If id is provided, clear cache for a specific schema
  if (id) {
    const schemaId = id as string;
    schemaCache.deleteSchema(schemaId);
    schemaCache.deleteSchemaColumns(schemaId);

    return res.status(200).json({
      success: true,
      message: `Cache cleared for schema ${schemaId}`,
    });
  }
  // If all is true, clear the entire cache
  else if (all === "true") {
    schemaCache.flush();
    schemaCache.resetStats();

    return res.status(200).json({
      success: true,
      message: "Entire cache cleared",
    });
  }
  // Otherwise, clear cache for the user's schemas
  else {
    const userSchemaKeys = schemaCache
      .keys()
      .filter(
        (key) =>
          key.startsWith(`schemas:user:${userId}`) ||
          key.startsWith(`schemas:project:`)
      );

    if (userSchemaKeys.length > 0) {
      schemaCache.deleteMulti(userSchemaKeys);
    }

    return res.status(200).json({
      success: true,
      message: `Cache cleared for user ${userId}`,
      keysCleared: userSchemaKeys.length,
    });
  }
}

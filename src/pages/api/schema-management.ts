import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { GlobalSchemaService } from "../../../lib/globalSchemaService";

/**
 * API handler for schema management operations
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
  console.log(`[schema-management] Using user ID: ${userId}`);
  const schemaService = new GlobalSchemaService();

  try {
    // Handle different HTTP methods
    switch (req.method) {
      case "GET":
        // Get schemas or a specific schema
        if (req.query.id) {
          // Get a specific schema by ID
          const schema = await schemaService.getGlobalSchemaById(
            req.query.id as string
          );

          if (!schema) {
            return res.status(404).json({ error: "Schema not found" });
          }

          // Check if the schema belongs to the user
          if (schema.userId !== userId) {
            return res.status(403).json({ error: "Forbidden" });
          }

          return res.status(200).json({ schema });
        } else if (req.query.projectId) {
          // Get all schemas for a project
          const schemas = await schemaService.getGlobalSchemas(
            userId,
            req.query.projectId as string
          );
          return res.status(200).json({ schemas });
        } else {
          // Get all schemas for the user
          const schemas = await schemaService.getGlobalSchemas(userId);
          return res.status(200).json({ schemas });
        }

      case "POST":
        // Create a new schema
        if (req.body.action === "create_from_template") {
          // Create a schema from a template
          const { projectId, templateName, name, description } = req.body;

          if (!name) {
            return res.status(400).json({ error: "Schema name is required" });
          }

          if (!templateName) {
            return res.status(400).json({ error: "Template name is required" });
          }

          try {
            const schema = await schemaService.createSchemaFromTemplate(
              userId,
              projectId,
              templateName,
              name,
              description
            );

            return res.status(201).json({ schema });
          } catch (error) {
            return res.status(400).json({
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to create schema from template",
            });
          }
        } else if (req.body.action === "save_mapping") {
          // Save column mapping
          const { fileId, schemaId, mappings } = req.body;

          if (!fileId || !schemaId || !mappings) {
            return res.status(400).json({ error: "Missing required fields" });
          }

          // Validate that the schema belongs to the user
          const schema = await schemaService.getGlobalSchemaById(schemaId);

          if (!schema || schema.userId !== userId) {
            return res.status(403).json({ error: "Forbidden" });
          }

          const mapping = {
            fileId,
            schemaId,
            mappings,
          };

          const success = await schemaService.saveColumnMapping(mapping);

          if (success) {
            return res.status(200).json({ success: true });
          } else {
            return res.status(500).json({ error: "Failed to save mapping" });
          }
        } else {
          // Default action: create schema with columns
          const { projectId, name, description, columns } = req.body;

          if (!name) {
            return res.status(400).json({ error: "Schema name is required" });
          }

          if (!columns || !Array.isArray(columns)) {
            return res.status(400).json({ error: "Columns must be an array" });
          }

          if (columns.length === 0) {
            return res
              .status(400)
              .json({ error: "Schema must have at least one column" });
          }

          try {
            const schema = await schemaService.createGlobalSchema(
              userId,
              projectId,
              name,
              description,
              columns
            );

            return res.status(201).json({ schema });
          } catch (error) {
            return res.status(400).json({
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to create schema with columns",
            });
          }
        }

      case "PUT":
        // Update an existing schema
        const { id, name, description, columns, isActive, createNewVersion } =
          req.body;

        if (!id) {
          return res.status(400).json({ error: "Schema ID is required" });
        }

        // Get the existing schema
        const existingSchema = await schemaService.getGlobalSchemaById(id);

        if (!existingSchema) {
          return res.status(404).json({ error: "Schema not found" });
        }

        // Check if the schema belongs to the user
        if (existingSchema.userId !== userId) {
          return res.status(403).json({ error: "Forbidden" });
        }

        // Update the schema
        const updatedSchema = {
          ...existingSchema,
          name: name || existingSchema.name,
          description:
            description !== undefined
              ? description
              : existingSchema.description,
          columns: columns || existingSchema.columns,
          isActive: isActive !== undefined ? isActive : existingSchema.isActive,
          updatedAt: new Date(),
        };

        const result = await schemaService.updateGlobalSchema(
          updatedSchema,
          createNewVersion === true
        );

        if (result) {
          // If this schema is now active, deactivate all other schemas
          if (isActive) {
            const allSchemas = await schemaService.getGlobalSchemas(
              userId,
              existingSchema.projectId
            );

            for (const schema of allSchemas) {
              if (schema.id !== id && schema.isActive) {
                await schemaService.updateGlobalSchema({
                  ...schema,
                  isActive: false,
                  updatedAt: new Date(),
                });
              }
            }
          }

          return res.status(200).json({ schema: result });
        } else {
          return res.status(500).json({ error: "Failed to update schema" });
        }

      case "DELETE":
        // Delete a schema
        const schemaId = req.query.id as string;
        console.log(
          `[schema-management] DELETE request for schema ID: ${schemaId}`
        );

        if (!schemaId) {
          console.log(
            `[schema-management] DELETE failed: Schema ID is required`
          );
          return res.status(400).json({ error: "Schema ID is required" });
        }

        // Get the schema to check ownership
        const schemaToDelete = await schemaService.getGlobalSchemaById(
          schemaId
        );

        if (!schemaToDelete) {
          console.log(
            `[schema-management] DELETE failed: Schema not found with ID ${schemaId}`
          );
          return res.status(404).json({ error: "Schema not found" });
        }

        console.log(
          `[schema-management] Found schema to delete: ${schemaToDelete.name}`
        );

        // Check if the schema belongs to the user
        if (schemaToDelete.userId !== userId) {
          console.log(
            `[schema-management] DELETE failed: Schema belongs to ${schemaToDelete.userId}, not ${userId}`
          );
          return res.status(403).json({ error: "Forbidden" });
        }

        console.log(
          `[schema-management] Attempting to delete schema ${schemaId}`
        );
        const deleteResult = await schemaService.deleteGlobalSchema(schemaId);
        console.log(`[schema-management] Delete result: ${deleteResult}`);

        if (deleteResult) {
          console.log(
            `[schema-management] Successfully deleted schema ${schemaId}`
          );
          return res.status(200).json({ success: true });
        } else {
          console.log(
            `[schema-management] Failed to delete schema ${schemaId}`
          );
          return res.status(500).json({ error: "Failed to delete schema" });
        }

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error in schema-management API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

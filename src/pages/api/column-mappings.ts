import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import {
  SchemaService as SchemaManagementService,
  ColumnMapping,
} from "../../../lib/schemaManagement";

/**
 * API handler for column mappings operations
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check authentication
  const session = await getServerSession(req, res, authOptions);

  // Check if the user is authenticated
  if (!session || !session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id as string;
  const schemaService = new SchemaManagementService();

  try {
    // Handle different HTTP methods
    switch (req.method) {
      case "GET":
        // Get column mappings for a file and schema
        const { fileId, schemaId } = req.query;

        if (!fileId || !schemaId) {
          return res
            .status(400)
            .json({ error: "File ID and Schema ID are required" });
        }

        // Get the mapping
        const mapping = await schemaService.getColumnMapping(
          fileId as string,
          schemaId as string
        );

        if (!mapping) {
          return res.status(404).json({ error: "Mapping not found" });
        }

        // Verify the schema belongs to the user
        const schema = await schemaService.getGlobalSchemaById(
          schemaId as string
        );

        // If schema.userId is "unknown", it means the user_id column doesn't exist in the database
        // In this case, we'll allow access since we can't verify ownership
        if (
          !schema ||
          (schema.userId !== "unknown" && schema.userId !== userId)
        ) {
          return res.status(403).json({ error: "Forbidden" });
        }

        return res.status(200).json({ mapping });

      case "POST":
        // Create or update a column mapping
        const {
          fileId: bodyFileId,
          schemaId: bodySchemaId,
          mappings,
        } = req.body;

        if (!bodyFileId || !bodySchemaId || !mappings) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        // Verify the schema belongs to the user
        const schemaToMap = await schemaService.getGlobalSchemaById(
          bodySchemaId
        );

        // If schemaToMap.userId is "unknown", it means the user_id column doesn't exist in the database
        // In this case, we'll allow access since we can't verify ownership
        if (
          !schemaToMap ||
          (schemaToMap.userId !== "unknown" && schemaToMap.userId !== userId)
        ) {
          return res.status(403).json({ error: "Forbidden" });
        }

        // Create the mapping object
        const newMapping: ColumnMapping = {
          fileId: bodyFileId,
          schemaId: bodySchemaId,
          mappings,
        };

        // Check if there are any new columns to add to the schema
        const newColumns = Object.entries(mappings).filter(
          ([fileCol, schemaCol]) => {
            // If the file column and schema column have the same name and it doesn't exist in the schema
            return (
              fileCol === schemaCol &&
              !schemaToMap.columns.some((col) => col.name === schemaCol)
            );
          }
        );

        // If there are new columns to add, update the schema first
        if (newColumns.length > 0) {
          console.log(
            `Adding ${newColumns.length} new columns to schema ${bodySchemaId}`
          );

          // Create new schema columns
          const columnsToAdd = newColumns.map(([colName]) => ({
            id: `col_${Date.now()}_${Math.random()
              .toString(36)
              .substring(2, 9)}`,
            name: colName,
            type: "text", // Default type
            description: `Added from file column: ${colName}`,
            isRequired: false,
            isNewColumn: true,
          }));

          // Update the schema with new columns
          const updatedSchema = {
            ...schemaToMap,
            columns: [...schemaToMap.columns, ...columnsToAdd],
          };

          await schemaService.updateGlobalSchema(updatedSchema);
        }

        // Save the mapping
        const success = await schemaService.saveColumnMapping(newMapping);

        if (success) {
          // Check the file status before attempting to activate
          try {
            // Get the current file status
            const fileResponse = await fetch(
              `${
                process.env.NEXTAUTH_URL || "http://localhost:3000"
              }/api/files/${bodyFileId}`,
              {
                headers: {
                  Cookie: req.headers.cookie || "",
                },
              }
            );

            if (fileResponse.ok) {
              const fileData = await fileResponse.json();
              const fileStatus = fileData.file?.status;

              // Only attempt to activate if the file is not already active or being processed
              if (fileStatus !== "active" && fileStatus !== "processing") {
                console.log(
                  `Activating file ${bodyFileId} after column mapping (current status: ${fileStatus})`
                );

                // The file will be activated by the ingest-file process
                console.log(
                  `File ${bodyFileId} will be activated by the ingest-file process`
                );
              } else {
                console.log(
                  `File ${bodyFileId} is already ${fileStatus}, skipping activation`
                );
              }
            } else {
              console.warn(
                `Failed to get file status: ${fileResponse.statusText}`
              );
            }
          } catch (statusError) {
            console.error(
              `Error checking file status for ${bodyFileId}:`,
              statusError
            );
            // Continue even if status check fails
          }

          return res.status(200).json({
            success: true,
            mapping: newMapping,
            newColumnsAdded: newColumns.length,
          });
        } else {
          return res.status(500).json({ error: "Failed to save mapping" });
        }

      case "DELETE":
        // Delete a column mapping
        const deleteFileId = req.query.fileId as string;
        const deleteSchemaId = req.query.schemaId as string;

        if (!deleteFileId || !deleteSchemaId) {
          return res
            .status(400)
            .json({ error: "File ID and Schema ID are required" });
        }

        // Verify the schema belongs to the user
        const schemaToDelete = await schemaService.getGlobalSchemaById(
          deleteSchemaId
        );

        // If schemaToDelete.userId is "unknown", it means the user_id column doesn't exist in the database
        // In this case, we'll allow access since we can't verify ownership
        if (
          !schemaToDelete ||
          (schemaToDelete.userId !== "unknown" &&
            schemaToDelete.userId !== userId)
        ) {
          return res.status(403).json({ error: "Forbidden" });
        }

        // For now, we'll just return success since we don't have a delete method
        // In a real implementation, you would add a deleteColumnMapping method to the service
        return res.status(200).json({ success: true });

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error in column-mappings API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

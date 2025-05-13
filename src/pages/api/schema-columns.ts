import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import {
  GlobalSchemaService,
  SchemaColumn,
} from "../../../lib/globalSchemaService";

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
  const schemaService = new GlobalSchemaService();

  try {
    // Handle different HTTP methods
    switch (req.method) {
      case "POST":
        // Add columns to an existing schema
        return await handleAddColumns(req, res, userId, schemaService);

      case "PUT":
        // Update an existing column
        return await handleUpdateColumn(req, res, userId, schemaService);

      case "DELETE":
        // Remove a column from a schema
        return await handleRemoveColumn(req, res, userId, schemaService);

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
 * Handle adding columns to an existing schema
 */
async function handleAddColumns(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  schemaService: GlobalSchemaService
) {
  const { schemaId, columns, createNewVersion = false } = req.body;

  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  if (!columns || !Array.isArray(columns) || columns.length === 0) {
    return res.status(400).json({ error: "At least one column is required" });
  }

  // Get the existing schema
  const schema = await schemaService.getGlobalSchemaById(schemaId);

  if (!schema) {
    return res.status(404).json({ error: "Schema not found" });
  }

  // Check if the schema belongs to the user
  if (schema.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Perform impact analysis
  const impactAnalysis = analyzeColumnAdditionImpact(schema.columns, columns);

  if (impactAnalysis.hasConflicts) {
    return res.status(400).json({
      error: "Column addition conflicts detected",
      conflicts: impactAnalysis.conflicts,
    });
  }

  // Add the new columns to the schema
  const updatedSchema = {
    ...schema,
    columns: [...schema.columns, ...columns],
    updatedAt: new Date(),
  };

  // Update the schema
  const result = await schemaService.updateGlobalSchema(
    updatedSchema,
    createNewVersion
  );

  if (result) {
    return res.status(200).json({
      schema: result,
      impactAnalysis: {
        warnings: impactAnalysis.warnings,
      },
    });
  } else {
    return res.status(500).json({ error: "Failed to update schema" });
  }
}

/**
 * Handle updating an existing column
 */
async function handleUpdateColumn(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  schemaService: GlobalSchemaService
) {
  const { schemaId, columnName, column, createNewVersion = false } = req.body;

  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  if (!columnName) {
    return res.status(400).json({ error: "Column name is required" });
  }

  if (!column) {
    return res.status(400).json({ error: "Column data is required" });
  }

  // Get the existing schema
  const schema = await schemaService.getGlobalSchemaById(schemaId);

  if (!schema) {
    return res.status(404).json({ error: "Schema not found" });
  }

  // Check if the schema belongs to the user
  if (schema.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Find the column to update
  const columnIndex = schema.columns.findIndex(
    (c) => c.name.toLowerCase() === columnName.toLowerCase()
  );

  if (columnIndex === -1) {
    return res.status(404).json({ error: "Column not found" });
  }

  // Perform impact analysis for the column update
  const impactAnalysis = analyzeColumnUpdateImpact(
    schema.columns[columnIndex],
    column
  );

  if (impactAnalysis.hasBreakingChanges) {
    return res.status(400).json({
      error: "Breaking changes detected",
      breakingChanges: impactAnalysis.breakingChanges,
    });
  }

  // Update the column
  const updatedColumns = [...schema.columns];
  updatedColumns[columnIndex] = {
    ...updatedColumns[columnIndex],
    ...column,
    name: columnName, // Ensure the name doesn't change
  };

  const updatedSchema = {
    ...schema,
    columns: updatedColumns,
    updatedAt: new Date(),
  };

  // Update the schema
  const result = await schemaService.updateGlobalSchema(
    updatedSchema,
    createNewVersion
  );

  if (result) {
    return res.status(200).json({
      schema: result,
      impactAnalysis: {
        warnings: impactAnalysis.warnings,
      },
    });
  } else {
    return res.status(500).json({ error: "Failed to update schema" });
  }
}

/**
 * Handle removing a column from a schema
 */
async function handleRemoveColumn(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  schemaService: GlobalSchemaService
) {
  const { schemaId, columnName, createNewVersion = true } = req.body;

  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  if (!columnName) {
    return res.status(400).json({ error: "Column name is required" });
  }

  // Get the existing schema
  const schema = await schemaService.getGlobalSchemaById(schemaId);

  if (!schema) {
    return res.status(404).json({ error: "Schema not found" });
  }

  // Check if the schema belongs to the user
  if (schema.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Find the column to remove
  const columnIndex = schema.columns.findIndex(
    (c) => c.name.toLowerCase() === columnName.toLowerCase()
  );

  if (columnIndex === -1) {
    return res.status(404).json({ error: "Column not found" });
  }

  // Check if the column is required
  if (schema.columns[columnIndex].isRequired) {
    return res.status(400).json({
      error: "Cannot remove a required column",
      suggestion:
        "Consider creating a new version of the schema with this column marked as optional first",
    });
  }

  // Remove the column
  const updatedColumns = schema.columns.filter(
    (_, index) => index !== columnIndex
  );

  const updatedSchema = {
    ...schema,
    columns: updatedColumns,
    updatedAt: new Date(),
  };

  // Update the schema
  const result = await schemaService.updateGlobalSchema(
    updatedSchema,
    createNewVersion
  );

  if (result) {
    return res.status(200).json({ schema: result });
  } else {
    return res.status(500).json({ error: "Failed to update schema" });
  }
}

/**
 * Analyze the impact of adding new columns to a schema
 */
function analyzeColumnAdditionImpact(
  existingColumns: SchemaColumn[],
  newColumns: SchemaColumn[]
) {
  const conflicts: string[] = [];
  const warnings: string[] = [];

  // Check for duplicate column names
  const existingColumnNames = new Set(
    existingColumns.map((c) => c.name.toLowerCase())
  );

  for (const column of newColumns) {
    if (existingColumnNames.has(column.name.toLowerCase())) {
      conflicts.push(
        `Column name '${column.name}' already exists in the schema`
      );
    }

    // Check for potential issues
    if (column.isRequired) {
      warnings.push(
        `Adding required column '${column.name}' may cause issues with existing data`
      );
    }

    if (column.isPrimaryKey) {
      warnings.push(
        `Adding primary key column '${column.name}' may cause issues with existing data`
      );
    }

    if (column.isForeignKey) {
      warnings.push(
        `Adding foreign key column '${column.name}' may require additional configuration`
      );
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    warnings,
  };
}

/**
 * Analyze the impact of updating a column
 */
function analyzeColumnUpdateImpact(
  existingColumn: SchemaColumn,
  updatedColumn: Partial<SchemaColumn>
) {
  const breakingChanges: string[] = [];
  const warnings: string[] = [];

  // Check for type changes
  if (
    updatedColumn.type &&
    updatedColumn.type !== existingColumn.type &&
    !isCompatibleTypeChange(existingColumn.type, updatedColumn.type)
  ) {
    breakingChanges.push(
      `Changing column type from '${existingColumn.type}' to '${updatedColumn.type}' may cause data loss`
    );
  }

  // Check for constraint changes
  if (updatedColumn.isRequired === true && existingColumn.isRequired !== true) {
    warnings.push(
      `Making column '${existingColumn.name}' required may cause issues with existing data`
    );
  }

  // Check for primary key changes
  if (
    updatedColumn.isPrimaryKey === true &&
    existingColumn.isPrimaryKey !== true
  ) {
    warnings.push(
      `Making column '${existingColumn.name}' a primary key may cause issues with existing data`
    );
  }

  // Check for foreign key changes
  if (
    updatedColumn.isForeignKey === true &&
    existingColumn.isForeignKey !== true
  ) {
    warnings.push(
      `Making column '${existingColumn.name}' a foreign key may require additional configuration`
    );
  }

  // Check for validation rule changes
  if (
    updatedColumn.validationRules &&
    areValidationRulesStricter(
      existingColumn.validationRules || [],
      updatedColumn.validationRules
    )
  ) {
    warnings.push(
      `Adding stricter validation rules to column '${existingColumn.name}' may cause issues with existing data`
    );
  }

  return {
    hasBreakingChanges: breakingChanges.length > 0,
    breakingChanges,
    warnings,
  };
}

/**
 * Check if a type change is compatible
 */
function isCompatibleTypeChange(
  existingType: string,
  newType: string
): boolean {
  // Define compatible type changes
  const compatibleChanges: Record<string, string[]> = {
    integer: ["numeric", "text"],
    numeric: ["text"],
    boolean: ["text"],
    timestamp: ["text"],
    text: [], // Text can't be safely converted to other types
  };

  return (
    existingType === newType ||
    (compatibleChanges[existingType.toLowerCase()] || []).includes(
      newType.toLowerCase()
    )
  );
}

/**
 * Check if new validation rules are stricter than existing ones
 */
function areValidationRulesStricter(
  existingRules: any[],
  newRules: any[]
): boolean {
  // This is a simplified check
  // In a real implementation, you would need to compare each rule type
  return newRules.length > existingRules.length;
}

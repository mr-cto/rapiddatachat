import { executeQuery } from "./database";
import { v4 as uuidv4 } from "uuid";
import { GlobalSchema, SchemaColumn } from "./globalSchemaService";

/**
 * Interface for schema change
 */
export interface SchemaChange {
  type: "add" | "remove" | "modify";
  columnName: string;
  before?: Partial<SchemaColumn>;
  after?: Partial<SchemaColumn>;
}

/**
 * Interface for schema version
 */
export interface SchemaVersion {
  id: string;
  schemaId: string;
  version: number;
  columns: SchemaColumn[];
  createdAt: Date;
  createdBy: string;
  comment?: string;
  changeLog?: SchemaChange[];
}

/**
 * Interface for schema comparison result
 */
export interface SchemaComparisonResult {
  added: SchemaColumn[];
  removed: SchemaColumn[];
  modified: {
    columnName: string;
    before: Partial<SchemaColumn>;
    after: Partial<SchemaColumn>;
  }[];
}

/**
 * Interface for rollback result
 */
export interface RollbackResult {
  success: boolean;
  message: string;
  schema?: GlobalSchema;
}

/**
 * Service for managing schema versions
 */
export class SchemaVersionService {
  /**
   * Create a new schema version
   * @param schema Schema to version
   * @param userId User ID
   * @param comment Comment
   * @returns Promise<SchemaVersion> Created version
   */
  async createSchemaVersion(
    schema: GlobalSchema,
    userId: string,
    comment?: string
  ): Promise<SchemaVersion> {
    try {
      // Check if the schema_versions table exists
      const tableExists = await this.checkIfTableExists("schema_versions");

      if (!tableExists) {
        // Create the table if it doesn't exist
        await executeQuery(`
          CREATE TABLE schema_versions (
            id TEXT PRIMARY KEY,
            schema_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            columns JSONB NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT NOT NULL,
            comment TEXT,
            change_log JSONB
          )
        `);
      }

      // Generate version ID
      const versionId = `version_${uuidv4()}`;

      // Get previous version if exists
      let previousVersion: SchemaVersion | null = null;
      let changeLog: SchemaChange[] = [];

      if (schema.version > 1) {
        previousVersion = await this.getSchemaVersion(
          schema.id,
          schema.version - 1
        );

        if (previousVersion) {
          // Compare schemas to generate change log
          const comparison = this.compareSchemas(
            previousVersion.columns,
            schema.columns
          );

          // Create change log
          changeLog = [
            ...comparison.added.map((column) => ({
              type: "add" as const,
              columnName: column.name,
              after: column,
            })),
            ...comparison.removed.map((column) => ({
              type: "remove" as const,
              columnName: column.name,
              before: column,
            })),
            ...comparison.modified.map((change) => ({
              type: "modify" as const,
              columnName: change.columnName,
              before: change.before,
              after: change.after,
            })),
          ];
        }
      }

      // Create version
      await executeQuery(`
        INSERT INTO schema_versions (
          id,
          schema_id,
          version,
          columns,
          created_at,
          created_by,
          comment,
          change_log
        )
        VALUES (
          '${versionId}',
          '${schema.id}',
          ${schema.version},
          '${JSON.stringify(schema.columns)}',
          CURRENT_TIMESTAMP,
          '${userId}',
          ${comment ? `'${comment}'` : "NULL"},
          ${changeLog.length > 0 ? `'${JSON.stringify(changeLog)}'` : "NULL"}
        )
      `);

      // Return created version
      return {
        id: versionId,
        schemaId: schema.id,
        version: schema.version,
        columns: schema.columns,
        createdAt: new Date(),
        createdBy: userId,
        comment,
        changeLog,
      };
    } catch (error) {
      console.error(
        `[SchemaVersionService] Error creating version for schema ${schema.id}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get schema version
   * @param schemaId Schema ID
   * @param version Version number
   * @returns Promise<SchemaVersion | null> Schema version or null if not found
   */
  async getSchemaVersion(
    schemaId: string,
    version: number
  ): Promise<SchemaVersion | null> {
    try {
      // Check if the schema_versions table exists
      const tableExists = await this.checkIfTableExists("schema_versions");

      if (!tableExists) {
        return null;
      }

      // Get version
      const result = (await executeQuery(`
        SELECT id, schema_id, version, columns, created_at, created_by, comment, change_log
        FROM schema_versions
        WHERE schema_id = '${schemaId}' AND version = ${version}
      `)) as Array<{
        id: string;
        schema_id: string;
        version: number;
        columns: string;
        created_at: string;
        created_by: string;
        comment: string;
        change_log: string;
      }>;

      if (!result || result.length === 0) {
        return null;
      }

      const versionData = result[0];

      // Parse columns
      let parsedColumns: SchemaColumn[] = [];
      try {
        if (versionData.columns) {
          if (typeof versionData.columns === "string") {
            parsedColumns = JSON.parse(versionData.columns);
          } else if (typeof versionData.columns === "object") {
            parsedColumns = versionData.columns as unknown as SchemaColumn[];
          }
        }
      } catch (parseError) {
        console.error(
          `[SchemaVersionService] Error parsing columns for version ${versionData.id}:`,
          parseError
        );
        parsedColumns = [];
      }

      // Parse change log
      let parsedChangeLog: SchemaChange[] = [];
      try {
        if (versionData.change_log) {
          if (typeof versionData.change_log === "string") {
            parsedChangeLog = JSON.parse(versionData.change_log);
          } else if (typeof versionData.change_log === "object") {
            parsedChangeLog =
              versionData.change_log as unknown as SchemaChange[];
          }
        }
      } catch (parseError) {
        console.error(
          `[SchemaVersionService] Error parsing change log for version ${versionData.id}:`,
          parseError
        );
        parsedChangeLog = [];
      }

      // Return version
      return {
        id: versionData.id,
        schemaId: versionData.schema_id,
        version: versionData.version,
        columns: parsedColumns,
        createdAt: new Date(versionData.created_at),
        createdBy: versionData.created_by,
        comment: versionData.comment,
        changeLog: parsedChangeLog,
      };
    } catch (error) {
      console.error(
        `[SchemaVersionService] Error getting version for schema ${schemaId} version ${version}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get schema versions
   * @param schemaId Schema ID
   * @returns Promise<SchemaVersion[]> Schema versions
   */
  async getSchemaVersions(schemaId: string): Promise<SchemaVersion[]> {
    try {
      // Check if the schema_versions table exists
      const tableExists = await this.checkIfTableExists("schema_versions");

      if (!tableExists) {
        return [];
      }

      // Get versions
      const result = (await executeQuery(`
        SELECT id, schema_id, version, columns, created_at, created_by, comment, change_log
        FROM schema_versions
        WHERE schema_id = '${schemaId}'
        ORDER BY version DESC
      `)) as Array<{
        id: string;
        schema_id: string;
        version: number;
        columns: string;
        created_at: string;
        created_by: string;
        comment: string;
        change_log: string;
      }>;

      if (!result || result.length === 0) {
        return [];
      }

      // Parse versions
      return result.map((versionData) => {
        // Parse columns
        let parsedColumns: SchemaColumn[] = [];
        try {
          if (versionData.columns) {
            if (typeof versionData.columns === "string") {
              parsedColumns = JSON.parse(versionData.columns);
            } else if (typeof versionData.columns === "object") {
              parsedColumns = versionData.columns as unknown as SchemaColumn[];
            }
          }
        } catch (parseError) {
          console.error(
            `[SchemaVersionService] Error parsing columns for version ${versionData.id}:`,
            parseError
          );
          parsedColumns = [];
        }

        // Parse change log
        let parsedChangeLog: SchemaChange[] = [];
        try {
          if (versionData.change_log) {
            if (typeof versionData.change_log === "string") {
              parsedChangeLog = JSON.parse(versionData.change_log);
            } else if (typeof versionData.change_log === "object") {
              parsedChangeLog =
                versionData.change_log as unknown as SchemaChange[];
            }
          }
        } catch (parseError) {
          console.error(
            `[SchemaVersionService] Error parsing change log for version ${versionData.id}:`,
            parseError
          );
          parsedChangeLog = [];
        }

        // Return version
        return {
          id: versionData.id,
          schemaId: versionData.schema_id,
          version: versionData.version,
          columns: parsedColumns,
          createdAt: new Date(versionData.created_at),
          createdBy: versionData.created_by,
          comment: versionData.comment,
          changeLog: parsedChangeLog,
        };
      });
    } catch (error) {
      console.error(
        `[SchemaVersionService] Error getting versions for schema ${schemaId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Rollback schema to a previous version
   * @param schemaId Schema ID
   * @param version Version to rollback to
   * @param userId User ID
   * @returns Promise<RollbackResult> Rollback result
   */
  async rollbackSchema(
    schemaId: string,
    version: number,
    userId: string
  ): Promise<RollbackResult> {
    try {
      // Get the version to rollback to
      const targetVersion = await this.getSchemaVersion(schemaId, version);

      if (!targetVersion) {
        return {
          success: false,
          message: `Version ${version} not found for schema ${schemaId}`,
        };
      }

      // Get the current schema
      const globalSchemaService = new (
        await import("./globalSchemaService")
      ).GlobalSchemaService();
      const currentSchema = await globalSchemaService.getGlobalSchemaById(
        schemaId
      );

      if (!currentSchema) {
        return {
          success: false,
          message: `Schema ${schemaId} not found`,
        };
      }

      // Create a new schema version with the rolled back columns
      const rolledBackSchema: GlobalSchema = {
        ...currentSchema,
        columns: targetVersion.columns,
        version: currentSchema.version + 1,
        previousVersionId: currentSchema.id,
        updatedAt: new Date(),
      };

      // Create a new version
      await this.createSchemaVersion(
        rolledBackSchema,
        userId,
        `Rolled back to version ${version}`
      );

      // Update the schema
      const updatedSchema = await globalSchemaService.updateGlobalSchema(
        rolledBackSchema
      );

      return {
        success: true,
        message: `Successfully rolled back schema ${schemaId} to version ${version}`,
        schema: updatedSchema,
      };
    } catch (error) {
      console.error(
        `[SchemaVersionService] Error rolling back schema ${schemaId} to version ${version}:`,
        error
      );
      return {
        success: false,
        message: `Error rolling back schema: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Compare two schemas to find differences
   * @param oldColumns Old columns
   * @param newColumns New columns
   * @returns SchemaComparisonResult Comparison result
   */
  compareSchemas(
    oldColumns: SchemaColumn[],
    newColumns: SchemaColumn[]
  ): SchemaComparisonResult {
    // Create maps for faster lookup
    const oldColumnsMap = new Map<string, SchemaColumn>();
    for (const column of oldColumns) {
      oldColumnsMap.set(column.name, column);
    }

    const newColumnsMap = new Map<string, SchemaColumn>();
    for (const column of newColumns) {
      newColumnsMap.set(column.name, column);
    }

    // Find added columns
    const added: SchemaColumn[] = [];
    for (const column of newColumns) {
      if (!oldColumnsMap.has(column.name)) {
        added.push(column);
      }
    }

    // Find removed columns
    const removed: SchemaColumn[] = [];
    for (const column of oldColumns) {
      if (!newColumnsMap.has(column.name)) {
        removed.push(column);
      }
    }

    // Find modified columns
    const modified: {
      columnName: string;
      before: Partial<SchemaColumn>;
      after: Partial<SchemaColumn>;
    }[] = [];

    for (const oldColumn of oldColumns) {
      const newColumn = newColumnsMap.get(oldColumn.name);
      if (newColumn) {
        const changes: Partial<SchemaColumn> = {};
        let hasChanges = false;

        // Compare properties
        for (const key of Object.keys(oldColumn) as Array<keyof SchemaColumn>) {
          if (key === "id") continue; // Skip ID

          if (
            JSON.stringify(oldColumn[key]) !== JSON.stringify(newColumn[key])
          ) {
            // Type-safe assignment
            if (key === "name" || key === "type" || key === "description") {
              changes[key] = newColumn[key];
            } else if (
              key === "isRequired" ||
              key === "isPrimaryKey" ||
              key === "isNewColumn"
            ) {
              changes[key] = newColumn[key];
            } else if (key === "defaultValue" || key === "derivationFormula") {
              changes[key] = newColumn[key];
            }
            hasChanges = true;
          }
        }

        if (hasChanges) {
          modified.push({
            columnName: oldColumn.name,
            before: oldColumn,
            after: changes,
          });
        }
      }
    }

    return {
      added,
      removed,
      modified,
    };
  }

  /**
   * Check if a table exists
   * @param tableName Table name
   * @returns Promise<boolean> True if the table exists
   */
  private async checkIfTableExists(tableName: string): Promise<boolean> {
    try {
      const result = (await executeQuery(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = '${tableName}'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      return result && result.length > 0 && result[0].exists;
    } catch (error) {
      console.error(
        `[SchemaVersionService] Error checking if table ${tableName} exists:`,
        error
      );
      return false;
    }
  }

  /**
   * Generate a change script for schema comparison
   * @param comparison Schema comparison result
   * @returns string Change script
   */
  generateChangeScript(comparison: SchemaComparisonResult): string {
    const lines: string[] = [];

    // Add header
    lines.push("-- Schema Change Script");
    lines.push("-- Generated at " + new Date().toISOString());
    lines.push("");

    // Add added columns
    if (comparison.added.length > 0) {
      lines.push("-- Added Columns");
      for (const column of comparison.added) {
        const typeStr = this.getSqlType(column.type);
        const nullStr = column.isRequired ? "NOT NULL" : "NULL";
        const defaultStr = column.defaultValue
          ? `DEFAULT ${column.defaultValue}`
          : "";
        const primaryKeyStr = column.isPrimaryKey ? "PRIMARY KEY" : "";

        lines.push(
          `ALTER TABLE [table_name] ADD COLUMN ${column.name} ${typeStr} ${nullStr} ${defaultStr} ${primaryKeyStr};`
        );
      }
      lines.push("");
    }

    // Add removed columns
    if (comparison.removed.length > 0) {
      lines.push("-- Removed Columns");
      for (const column of comparison.removed) {
        lines.push(`ALTER TABLE [table_name] DROP COLUMN ${column.name};`);
      }
      lines.push("");
    }

    // Add modified columns
    if (comparison.modified.length > 0) {
      lines.push("-- Modified Columns");
      for (const change of comparison.modified) {
        const before = change.before;
        const after = change.after;

        // Type change
        if (after.type && before.type !== after.type) {
          const typeStr = this.getSqlType(after.type);
          lines.push(
            `ALTER TABLE [table_name] ALTER COLUMN ${change.columnName} TYPE ${typeStr};`
          );
        }

        // Nullability change
        if (
          after.isRequired !== undefined &&
          before.isRequired !== after.isRequired
        ) {
          const nullStr = after.isRequired ? "NOT NULL" : "NULL";
          lines.push(
            `ALTER TABLE [table_name] ALTER COLUMN ${change.columnName} SET ${nullStr};`
          );
        }

        // Default value change
        if (
          after.defaultValue !== undefined &&
          before.defaultValue !== after.defaultValue
        ) {
          if (after.defaultValue) {
            lines.push(
              `ALTER TABLE [table_name] ALTER COLUMN ${change.columnName} SET DEFAULT ${after.defaultValue};`
            );
          } else {
            lines.push(
              `ALTER TABLE [table_name] ALTER COLUMN ${change.columnName} DROP DEFAULT;`
            );
          }
        }
      }
      lines.push("");
    }

    // Add footer
    lines.push("-- End of Change Script");

    return lines.join("\n");
  }

  /**
   * Get SQL type from schema column type
   * @param type Schema column type
   * @returns string SQL type
   */
  private getSqlType(type: string): string {
    switch (type) {
      case "string":
        return "VARCHAR(255)";
      case "integer":
        return "INTEGER";
      case "decimal":
        return "DECIMAL(18,2)";
      case "boolean":
        return "BOOLEAN";
      case "date":
        return "DATE";
      case "timestamp":
        return "TIMESTAMP";
      case "json":
        return "JSONB";
      case "array":
        return "JSONB";
      default:
        return "VARCHAR(255)";
    }
  }
}

export default new SchemaVersionService();

import { executeQuery } from "./database";
import { v4 as uuidv4 } from "uuid";
import { GlobalSchema, SchemaColumn } from "./globalSchemaService";

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
 * Interface for schema change
 */
export interface SchemaChange {
  type: "add" | "remove" | "modify";
  columnName: string;
  before?: Partial<SchemaColumn>;
  after?: Partial<SchemaColumn>;
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
  unchanged: SchemaColumn[];
}

/**
 * Interface for schema rollback result
 */
export interface SchemaRollbackResult {
  success: boolean;
  message: string;
  schema?: GlobalSchema;
}

/**
 * SchemaVersionService class for managing schema versions
 */
export class SchemaVersionService {
  /**
   * Create a new schema version
   * @param schema Global schema
   * @param userId User ID
   * @param comment Comment for the version
   * @returns Promise<SchemaVersion> Created schema version
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

      // Get the previous version if it exists
      const previousVersion = await this.getLatestSchemaVersion(schema.id);

      // Calculate the version number
      const version = previousVersion ? previousVersion.version + 1 : 1;

      // Calculate the change log if there's a previous version
      let changeLog: SchemaChange[] = [];
      if (previousVersion) {
        const comparison = this.compareSchemas(
          previousVersion.columns,
          schema.columns
        );

        // Convert comparison to change log
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
          ...comparison.modified.map((mod) => ({
            type: "modify" as const,
            columnName: mod.columnName,
            before: mod.before,
            after: mod.after,
          })),
        ];
      }

      // Create the schema version
      const versionId = `schema_version_${uuidv4()}`;
      const schemaVersion: SchemaVersion = {
        id: versionId,
        schemaId: schema.id,
        version,
        columns: schema.columns,
        createdAt: new Date(),
        createdBy: userId,
        comment,
        changeLog,
      };

      // Store the schema version in the database
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
          '${schemaVersion.id}',
          '${schemaVersion.schemaId}',
          ${schemaVersion.version},
          '${JSON.stringify(schemaVersion.columns)}',
          CURRENT_TIMESTAMP,
          '${schemaVersion.createdBy}',
          ${schemaVersion.comment ? `'${schemaVersion.comment}'` : "NULL"},
          ${
            schemaVersion.changeLog
              ? `'${JSON.stringify(schemaVersion.changeLog)}'`
              : "NULL"
          }
        )
      `);

      return schemaVersion;
    } catch (error) {
      console.error(
        "[SchemaVersionService] Error creating schema version:",
        error
      );
      throw error;
    }
  }

  /**
   * Get all versions of a schema
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

      // Get all versions for the schema
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

      // Convert the result to SchemaVersion objects
      return (result || []).map((row) => {
        let parsedColumns = [];
        let parsedChangeLog = [];

        try {
          // Parse columns
          if (row.columns) {
            if (typeof row.columns === "string") {
              parsedColumns = JSON.parse(row.columns);
            } else if (typeof row.columns === "object") {
              parsedColumns = row.columns;
            }
          }

          // Parse change log
          if (row.change_log) {
            if (typeof row.change_log === "string") {
              parsedChangeLog = JSON.parse(row.change_log);
            } else if (typeof row.change_log === "object") {
              parsedChangeLog = row.change_log;
            }
          }
        } catch (parseError) {
          console.error(
            `[SchemaVersionService] Error parsing data for schema version ${row.id}:`,
            parseError
          );
        }

        return {
          id: row.id,
          schemaId: row.schema_id,
          version: row.version,
          columns: parsedColumns,
          createdAt: new Date(row.created_at),
          createdBy: row.created_by,
          comment: row.comment,
          changeLog: parsedChangeLog,
        };
      });
    } catch (error) {
      console.error(
        `[SchemaVersionService] Error getting schema versions for schema ${schemaId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Get a specific schema version
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

      // Get the version
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

      const row = result[0];

      // Parse columns and change log
      let parsedColumns = [];
      let parsedChangeLog = [];

      try {
        // Parse columns
        if (row.columns) {
          if (typeof row.columns === "string") {
            parsedColumns = JSON.parse(row.columns);
          } else if (typeof row.columns === "object") {
            parsedColumns = row.columns;
          }
        }

        // Parse change log
        if (row.change_log) {
          if (typeof row.change_log === "string") {
            parsedChangeLog = JSON.parse(row.change_log);
          } else if (typeof row.change_log === "object") {
            parsedChangeLog = row.change_log;
          }
        }
      } catch (parseError) {
        console.error(
          `[SchemaVersionService] Error parsing data for schema version ${row.id}:`,
          parseError
        );
      }

      return {
        id: row.id,
        schemaId: row.schema_id,
        version: row.version,
        columns: parsedColumns,
        createdAt: new Date(row.created_at),
        createdBy: row.created_by,
        comment: row.comment,
        changeLog: parsedChangeLog,
      };
    } catch (error) {
      console.error(
        `[SchemaVersionService] Error getting schema version ${version} for schema ${schemaId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get the latest version of a schema
   * @param schemaId Schema ID
   * @returns Promise<SchemaVersion | null> Latest schema version or null if not found
   */
  async getLatestSchemaVersion(
    schemaId: string
  ): Promise<SchemaVersion | null> {
    try {
      // Check if the schema_versions table exists
      const tableExists = await this.checkIfTableExists("schema_versions");

      if (!tableExists) {
        return null;
      }

      // Get the latest version
      const result = (await executeQuery(`
        SELECT id, schema_id, version, columns, created_at, created_by, comment, change_log
        FROM schema_versions
        WHERE schema_id = '${schemaId}'
        ORDER BY version DESC
        LIMIT 1
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

      const row = result[0];

      // Parse columns and change log
      let parsedColumns = [];
      let parsedChangeLog = [];

      try {
        // Parse columns
        if (row.columns) {
          if (typeof row.columns === "string") {
            parsedColumns = JSON.parse(row.columns);
          } else if (typeof row.columns === "object") {
            parsedColumns = row.columns;
          }
        }

        // Parse change log
        if (row.change_log) {
          if (typeof row.change_log === "string") {
            parsedChangeLog = JSON.parse(row.change_log);
          } else if (typeof row.change_log === "object") {
            parsedChangeLog = row.change_log;
          }
        }
      } catch (parseError) {
        console.error(
          `[SchemaVersionService] Error parsing data for schema version ${row.id}:`,
          parseError
        );
      }

      return {
        id: row.id,
        schemaId: row.schema_id,
        version: row.version,
        columns: parsedColumns,
        createdAt: new Date(row.created_at),
        createdBy: row.created_by,
        comment: row.comment,
        changeLog: parsedChangeLog,
      };
    } catch (error) {
      console.error(
        `[SchemaVersionService] Error getting latest schema version for schema ${schemaId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Compare two schemas
   * @param oldColumns Old schema columns
   * @param newColumns New schema columns
   * @returns SchemaComparisonResult Comparison result
   */
  compareSchemas(
    oldColumns: SchemaColumn[],
    newColumns: SchemaColumn[]
  ): SchemaComparisonResult {
    const oldColumnMap = new Map<string, SchemaColumn>();
    for (const column of oldColumns) {
      oldColumnMap.set(column.name, column);
    }

    const newColumnMap = new Map<string, SchemaColumn>();
    for (const column of newColumns) {
      newColumnMap.set(column.name, column);
    }

    const added: SchemaColumn[] = [];
    const removed: SchemaColumn[] = [];
    const modified: {
      columnName: string;
      before: Partial<SchemaColumn>;
      after: Partial<SchemaColumn>;
    }[] = [];
    const unchanged: SchemaColumn[] = [];

    // Find added and modified columns
    for (const column of newColumns) {
      const oldColumn = oldColumnMap.get(column.name);
      if (!oldColumn) {
        added.push(column);
      } else {
        // Check if the column has been modified
        const changes: Partial<SchemaColumn> = {};
        let hasChanges = false;

        // Check each property
        if (column.type !== oldColumn.type) {
          changes.type = column.type;
          hasChanges = true;
        }
        if (column.description !== oldColumn.description) {
          changes.description = column.description;
          hasChanges = true;
        }
        if (column.isRequired !== oldColumn.isRequired) {
          changes.isRequired = column.isRequired;
          hasChanges = true;
        }
        if (column.isPrimaryKey !== oldColumn.isPrimaryKey) {
          changes.isPrimaryKey = column.isPrimaryKey;
          hasChanges = true;
        }
        if (column.isForeignKey !== oldColumn.isForeignKey) {
          changes.isForeignKey = column.isForeignKey;
          hasChanges = true;
        }
        if (column.referencesTable !== oldColumn.referencesTable) {
          changes.referencesTable = column.referencesTable;
          hasChanges = true;
        }
        if (column.referencesColumn !== oldColumn.referencesColumn) {
          changes.referencesColumn = column.referencesColumn;
          hasChanges = true;
        }
        if (column.defaultValue !== oldColumn.defaultValue) {
          changes.defaultValue = column.defaultValue;
          hasChanges = true;
        }

        // Check validation rules
        if (
          JSON.stringify(column.validationRules) !==
          JSON.stringify(oldColumn.validationRules)
        ) {
          changes.validationRules = column.validationRules;
          hasChanges = true;
        }

        if (hasChanges) {
          modified.push({
            columnName: column.name,
            before: oldColumn,
            after: column,
          });
        } else {
          unchanged.push(column);
        }
      }
    }

    // Find removed columns
    for (const column of oldColumns) {
      if (!newColumnMap.has(column.name)) {
        removed.push(column);
      }
    }

    return {
      added,
      removed,
      modified,
      unchanged,
    };
  }

  /**
   * Generate a change script for schema changes
   * @param comparison Schema comparison result
   * @returns string Change script
   */
  generateChangeScript(comparison: SchemaComparisonResult): string {
    let script = "";

    // Add columns
    for (const column of comparison.added) {
      script += `-- Add column ${column.name}\n`;
      script += `ALTER TABLE data ADD COLUMN ${column.name} ${this.getSqlType(
        column.type
      )}`;

      if (column.isRequired) {
        script += " NOT NULL";
      }

      if (column.defaultValue) {
        script += ` DEFAULT ${column.defaultValue}`;
      }

      script += ";\n\n";
    }

    // Modify columns
    for (const mod of comparison.modified) {
      script += `-- Modify column ${mod.columnName}\n`;

      // Type change
      if (mod.after.type !== mod.before.type) {
        script += `ALTER TABLE data ALTER COLUMN ${
          mod.columnName
        } TYPE ${this.getSqlType(mod.after.type || "text")};\n`;
      }

      // Required change
      if (mod.after.isRequired !== mod.before.isRequired) {
        if (mod.after.isRequired) {
          script += `ALTER TABLE data ALTER COLUMN ${mod.columnName} SET NOT NULL;\n`;
        } else {
          script += `ALTER TABLE data ALTER COLUMN ${mod.columnName} DROP NOT NULL;\n`;
        }
      }

      // Default value change
      if (mod.after.defaultValue !== mod.before.defaultValue) {
        if (mod.after.defaultValue) {
          script += `ALTER TABLE data ALTER COLUMN ${mod.columnName} SET DEFAULT ${mod.after.defaultValue};\n`;
        } else {
          script += `ALTER TABLE data ALTER COLUMN ${mod.columnName} DROP DEFAULT;\n`;
        }
      }

      script += "\n";
    }

    // Remove columns
    for (const column of comparison.removed) {
      script += `-- Remove column ${column.name}\n`;
      script += `ALTER TABLE data DROP COLUMN ${column.name};\n\n`;
    }

    return script;
  }

  /**
   * Rollback a schema to a specific version
   * @param schemaId Schema ID
   * @param version Version number to rollback to
   * @param userId User ID
   * @returns Promise<SchemaRollbackResult> Rollback result
   */
  async rollbackSchema(
    schemaId: string,
    version: number,
    userId: string
  ): Promise<SchemaRollbackResult> {
    try {
      // Get the target version
      const targetVersion = await this.getSchemaVersion(schemaId, version);

      if (!targetVersion) {
        return {
          success: false,
          message: `Version ${version} not found for schema ${schemaId}`,
        };
      }

      // Get the current schema
      const result = (await executeQuery(`
        SELECT id, user_id, project_id, name, description, columns, created_at, updated_at, is_active, version, previous_version_id
        FROM global_schemas
        WHERE id = '${schemaId}'
      `)) as Array<{
        id: string;
        user_id: string;
        project_id: string;
        name: string;
        description: string;
        columns: string;
        created_at: string;
        updated_at: string;
        is_active: boolean;
        version: number;
        previous_version_id: string;
      }>;

      if (!result || result.length === 0) {
        return {
          success: false,
          message: `Schema ${schemaId} not found`,
        };
      }

      const row = result[0];

      // Create a new schema with the target version's columns
      const schema: GlobalSchema = {
        id: row.id,
        userId: row.user_id,
        projectId: row.project_id,
        name: row.name,
        description: row.description,
        columns: targetVersion.columns,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(),
        isActive: row.is_active,
        version: row.version + 1,
        previousVersionId: row.id,
      };

      // Update the schema in the database
      await executeQuery(`
        UPDATE global_schemas
        SET 
          columns = '${JSON.stringify(schema.columns)}',
          updated_at = CURRENT_TIMESTAMP,
          version = ${schema.version},
          previous_version_id = '${schema.previousVersionId}'
        WHERE id = '${schema.id}'
      `);

      // Create a new version for the rollback
      await this.createSchemaVersion(
        schema,
        userId,
        `Rollback to version ${version}`
      );

      return {
        success: true,
        message: `Schema ${schemaId} rolled back to version ${version}`,
        schema,
      };
    } catch (error) {
      console.error(
        `[SchemaVersionService] Error rolling back schema ${schemaId} to version ${version}:`,
        error
      );
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get SQL type for a schema column type
   * @param type Schema column type
   * @returns string SQL type
   */
  private getSqlType(type: string): string {
    switch (type.toLowerCase()) {
      case "text":
        return "TEXT";
      case "integer":
        return "INTEGER";
      case "numeric":
        return "NUMERIC";
      case "boolean":
        return "BOOLEAN";
      case "timestamp":
        return "TIMESTAMP";
      default:
        return "TEXT";
    }
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
}

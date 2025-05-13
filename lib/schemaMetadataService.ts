import { executeQuery } from "./database";
import { v4 as uuidv4 } from "uuid";

/**
 * Interface for schema metadata
 */
export interface SchemaMetadata {
  id: string;
  schemaId: string;
  key: string;
  value: any;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

/**
 * Interface for schema change
 */
export interface SchemaChange {
  id: string;
  schemaId: string;
  changeType:
    | "create"
    | "update"
    | "delete"
    | "column_add"
    | "column_update"
    | "column_delete";
  description: string;
  details: any;
  createdAt: Date;
  createdBy?: string;
}

/**
 * Interface for schema documentation
 */
export interface SchemaDocumentation {
  id: string;
  schemaId: string;
  section: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

/**
 * SchemaMetadataService class for managing schema metadata
 */
export class SchemaMetadataService {
  /**
   * Initialize the metadata tables
   */
  async initialize(): Promise<void> {
    try {
      // Check if the schema_metadata table exists
      const metadataTableExists = await this.checkIfTableExists(
        "schema_metadata"
      );
      if (!metadataTableExists) {
        // Create the schema_metadata table
        await executeQuery(`
          CREATE TABLE schema_metadata (
            id TEXT PRIMARY KEY,
            schema_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value JSONB NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            UNIQUE(schema_id, key)
          )
        `);
      }

      // Check if the schema_changes table exists
      const changesTableExists = await this.checkIfTableExists(
        "schema_changes"
      );
      if (!changesTableExists) {
        // Create the schema_changes table
        await executeQuery(`
          CREATE TABLE schema_changes (
            id TEXT PRIMARY KEY,
            schema_id TEXT NOT NULL,
            change_type TEXT NOT NULL,
            description TEXT NOT NULL,
            details JSONB NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT
          )
        `);
      }

      // Check if the schema_documentation table exists
      const documentationTableExists = await this.checkIfTableExists(
        "schema_documentation"
      );
      if (!documentationTableExists) {
        // Create the schema_documentation table
        await executeQuery(`
          CREATE TABLE schema_documentation (
            id TEXT PRIMARY KEY,
            schema_id TEXT NOT NULL,
            section TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            UNIQUE(schema_id, section)
          )
        `);
      }
    } catch (error) {
      console.error(
        "[SchemaMetadataService] Error initializing metadata tables:",
        error
      );
      throw error;
    }
  }

  /**
   * Set metadata for a schema
   * @param schemaId Schema ID
   * @param key Metadata key
   * @param value Metadata value
   * @param userId User ID
   * @returns Promise<SchemaMetadata> Created or updated metadata
   */
  async setMetadata(
    schemaId: string,
    key: string,
    value: any,
    userId?: string
  ): Promise<SchemaMetadata> {
    try {
      // Check if the schema_metadata table exists
      const tableExists = await this.checkIfTableExists("schema_metadata");
      if (!tableExists) {
        await this.initialize();
      }

      // Check if the metadata already exists
      const existingMetadata = await this.getMetadata(schemaId, key);

      if (existingMetadata) {
        // Update the existing metadata
        const updatedMetadata: SchemaMetadata = {
          ...existingMetadata,
          value,
          updatedAt: new Date(),
        };

        await executeQuery(`
          UPDATE schema_metadata
          SET value = '${JSON.stringify(value)}',
              updated_at = CURRENT_TIMESTAMP
          WHERE schema_id = '${schemaId}' AND key = '${key}'
        `);

        return updatedMetadata;
      } else {
        // Create new metadata
        const metadata: SchemaMetadata = {
          id: `metadata_${uuidv4()}`,
          schemaId,
          key,
          value,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: userId,
        };

        await executeQuery(`
          INSERT INTO schema_metadata (
            id,
            schema_id,
            key,
            value,
            created_at,
            updated_at,
            created_by
          )
          VALUES (
            '${metadata.id}',
            '${schemaId}',
            '${key}',
            '${JSON.stringify(value)}',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP,
            ${userId ? `'${userId}'` : "NULL"}
          )
        `);

        return metadata;
      }
    } catch (error) {
      console.error(
        `[SchemaMetadataService] Error setting metadata for schema ${schemaId}, key ${key}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get metadata for a schema
   * @param schemaId Schema ID
   * @param key Metadata key
   * @returns Promise<SchemaMetadata | null> Metadata or null if not found
   */
  async getMetadata(
    schemaId: string,
    key: string
  ): Promise<SchemaMetadata | null> {
    try {
      // Check if the schema_metadata table exists
      const tableExists = await this.checkIfTableExists("schema_metadata");
      if (!tableExists) {
        return null;
      }

      // Get the metadata
      const result = (await executeQuery(`
        SELECT id, schema_id, key, value, created_at, updated_at, created_by
        FROM schema_metadata
        WHERE schema_id = '${schemaId}' AND key = '${key}'
      `)) as Array<{
        id: string;
        schema_id: string;
        key: string;
        value: string;
        created_at: string;
        updated_at: string;
        created_by: string;
      }>;

      if (!result || result.length === 0) {
        return null;
      }

      const row = result[0];

      // Parse value with error handling
      let parsedValue = null;
      try {
        // Handle potential invalid JSON or empty strings
        if (row.value) {
          if (typeof row.value === "string") {
            // If it's a string, parse it
            if (row.value.trim() !== "") {
              parsedValue = JSON.parse(row.value);
            }
          } else if (typeof row.value === "object") {
            // If it's already an object, use it directly
            parsedValue = row.value;
          }
        }
      } catch (parseError) {
        console.error(
          `[SchemaMetadataService] Error parsing metadata value for schema ${schemaId}, key ${key}:`,
          parseError
        );
        // Use null as fallback
        parsedValue = null;
      }

      // Convert to a SchemaMetadata object
      return {
        id: row.id,
        schemaId: row.schema_id,
        key: row.key,
        value: parsedValue,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        createdBy: row.created_by,
      };
    } catch (error) {
      console.error(
        `[SchemaMetadataService] Error getting metadata for schema ${schemaId}, key ${key}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get all metadata for a schema
   * @param schemaId Schema ID
   * @returns Promise<SchemaMetadata[]> Array of metadata
   */
  async getAllMetadata(schemaId: string): Promise<SchemaMetadata[]> {
    try {
      // Check if the schema_metadata table exists
      const tableExists = await this.checkIfTableExists("schema_metadata");
      if (!tableExists) {
        return [];
      }

      // Get all metadata for the schema
      const result = (await executeQuery(`
        SELECT id, schema_id, key, value, created_at, updated_at, created_by
        FROM schema_metadata
        WHERE schema_id = '${schemaId}'
        ORDER BY key
      `)) as Array<{
        id: string;
        schema_id: string;
        key: string;
        value: string;
        created_at: string;
        updated_at: string;
        created_by: string;
      }>;

      if (!result || result.length === 0) {
        return [];
      }

      // Convert to SchemaMetadata objects
      return result.map((row) => {
        // Parse value with error handling
        let parsedValue = null;
        try {
          // Handle potential invalid JSON or empty strings
          if (row.value) {
            if (typeof row.value === "string") {
              // If it's a string, parse it
              if (row.value.trim() !== "") {
                parsedValue = JSON.parse(row.value);
              }
            } else if (typeof row.value === "object") {
              // If it's already an object, use it directly
              parsedValue = row.value;
            }
          }
        } catch (parseError) {
          console.error(
            `[SchemaMetadataService] Error parsing metadata value for schema ${schemaId}, key ${row.key}:`,
            parseError
          );
          // Use null as fallback
          parsedValue = null;
        }

        return {
          id: row.id,
          schemaId: row.schema_id,
          key: row.key,
          value: parsedValue,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          createdBy: row.created_by,
        };
      });
    } catch (error) {
      console.error(
        `[SchemaMetadataService] Error getting all metadata for schema ${schemaId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Delete metadata for a schema
   * @param schemaId Schema ID
   * @param key Metadata key
   * @returns Promise<boolean> True if deleted successfully
   */
  async deleteMetadata(schemaId: string, key: string): Promise<boolean> {
    try {
      // Check if the schema_metadata table exists
      const tableExists = await this.checkIfTableExists("schema_metadata");
      if (!tableExists) {
        return false;
      }

      // Delete the metadata
      await executeQuery(`
        DELETE FROM schema_metadata
        WHERE schema_id = '${schemaId}' AND key = '${key}'
      `);

      return true;
    } catch (error) {
      console.error(
        `[SchemaMetadataService] Error deleting metadata for schema ${schemaId}, key ${key}:`,
        error
      );
      return false;
    }
  }

  /**
   * Record a schema change
   * @param schemaId Schema ID
   * @param changeType Change type
   * @param description Change description
   * @param details Change details
   * @param userId User ID
   * @returns Promise<SchemaChange> Created change record
   */
  async recordChange(
    schemaId: string,
    changeType:
      | "create"
      | "update"
      | "delete"
      | "column_add"
      | "column_update"
      | "column_delete",
    description: string,
    details: any,
    userId?: string
  ): Promise<SchemaChange> {
    try {
      // Check if the schema_changes table exists
      const tableExists = await this.checkIfTableExists("schema_changes");
      if (!tableExists) {
        await this.initialize();
      }

      // Create a new change record
      const change: SchemaChange = {
        id: `change_${uuidv4()}`,
        schemaId,
        changeType,
        description,
        details,
        createdAt: new Date(),
        createdBy: userId,
      };

      await executeQuery(`
        INSERT INTO schema_changes (
          id,
          schema_id,
          change_type,
          description,
          details,
          created_at,
          created_by
        )
        VALUES (
          '${change.id}',
          '${schemaId}',
          '${changeType}',
          '${description.replace(/'/g, "''")}',
          '${JSON.stringify(details)}',
          CURRENT_TIMESTAMP,
          ${userId ? `'${userId}'` : "NULL"}
        )
      `);

      return change;
    } catch (error) {
      console.error(
        `[SchemaMetadataService] Error recording change for schema ${schemaId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get changes for a schema
   * @param schemaId Schema ID
   * @param limit Maximum number of changes to return
   * @param offset Offset for pagination
   * @returns Promise<SchemaChange[]> Array of changes
   */
  async getChanges(
    schemaId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<SchemaChange[]> {
    try {
      // Check if the schema_changes table exists
      const tableExists = await this.checkIfTableExists("schema_changes");
      if (!tableExists) {
        return [];
      }

      // Get changes for the schema
      const result = (await executeQuery(`
        SELECT id, schema_id, change_type, description, details, created_at, created_by
        FROM schema_changes
        WHERE schema_id = '${schemaId}'
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `)) as Array<{
        id: string;
        schema_id: string;
        change_type:
          | "create"
          | "update"
          | "delete"
          | "column_add"
          | "column_update"
          | "column_delete";
        description: string;
        details: string;
        created_at: string;
        created_by: string;
      }>;

      if (!result || result.length === 0) {
        return [];
      }

      // Convert to SchemaChange objects
      return result.map((row) => {
        // Parse details with error handling
        let parsedDetails = {};
        try {
          // Handle potential invalid JSON or empty strings
          if (row.details) {
            if (typeof row.details === "string") {
              // If it's a string, parse it
              if (row.details.trim() !== "") {
                parsedDetails = JSON.parse(row.details);
              }
            } else if (typeof row.details === "object") {
              // If it's already an object, use it directly
              parsedDetails = row.details;
            }
          }
        } catch (parseError) {
          console.error(
            `[SchemaMetadataService] Error parsing change details for schema ${schemaId}, change ${row.id}:`,
            parseError
          );
          // Use empty object as fallback
          parsedDetails = {};
        }

        return {
          id: row.id,
          schemaId: row.schema_id,
          changeType: row.change_type,
          description: row.description,
          details: parsedDetails,
          createdAt: new Date(row.created_at),
          createdBy: row.created_by,
        };
      });
    } catch (error) {
      console.error(
        `[SchemaMetadataService] Error getting changes for schema ${schemaId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Set documentation for a schema
   * @param schemaId Schema ID
   * @param section Documentation section
   * @param content Documentation content
   * @param userId User ID
   * @returns Promise<SchemaDocumentation> Created or updated documentation
   */
  async setDocumentation(
    schemaId: string,
    section: string,
    content: string,
    userId?: string
  ): Promise<SchemaDocumentation> {
    try {
      // Check if the schema_documentation table exists
      const tableExists = await this.checkIfTableExists("schema_documentation");
      if (!tableExists) {
        await this.initialize();
      }

      // Check if the documentation already exists
      const existingDocumentation = await this.getDocumentation(
        schemaId,
        section
      );

      if (existingDocumentation) {
        // Update the existing documentation
        const updatedDocumentation: SchemaDocumentation = {
          ...existingDocumentation,
          content,
          updatedAt: new Date(),
        };

        await executeQuery(`
          UPDATE schema_documentation
          SET content = '${content.replace(/'/g, "''")}',
              updated_at = CURRENT_TIMESTAMP
          WHERE schema_id = '${schemaId}' AND section = '${section}'
        `);

        return updatedDocumentation;
      } else {
        // Create new documentation
        const documentation: SchemaDocumentation = {
          id: `doc_${uuidv4()}`,
          schemaId,
          section,
          content,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: userId,
        };

        await executeQuery(`
          INSERT INTO schema_documentation (
            id,
            schema_id,
            section,
            content,
            created_at,
            updated_at,
            created_by
          )
          VALUES (
            '${documentation.id}',
            '${schemaId}',
            '${section}',
            '${content.replace(/'/g, "''")}',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP,
            ${userId ? `'${userId}'` : "NULL"}
          )
        `);

        return documentation;
      }
    } catch (error) {
      console.error(
        `[SchemaMetadataService] Error setting documentation for schema ${schemaId}, section ${section}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get documentation for a schema
   * @param schemaId Schema ID
   * @param section Documentation section
   * @returns Promise<SchemaDocumentation | null> Documentation or null if not found
   */
  async getDocumentation(
    schemaId: string,
    section: string
  ): Promise<SchemaDocumentation | null> {
    try {
      // Check if the schema_documentation table exists
      const tableExists = await this.checkIfTableExists("schema_documentation");
      if (!tableExists) {
        return null;
      }

      // Get the documentation
      const result = (await executeQuery(`
        SELECT id, schema_id, section, content, created_at, updated_at, created_by
        FROM schema_documentation
        WHERE schema_id = '${schemaId}' AND section = '${section}'
      `)) as Array<{
        id: string;
        schema_id: string;
        section: string;
        content: string;
        created_at: string;
        updated_at: string;
        created_by: string;
      }>;

      if (!result || result.length === 0) {
        return null;
      }

      const row = result[0];

      // Convert to a SchemaDocumentation object
      return {
        id: row.id,
        schemaId: row.schema_id,
        section: row.section,
        content: row.content,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        createdBy: row.created_by,
      };
    } catch (error) {
      console.error(
        `[SchemaMetadataService] Error getting documentation for schema ${schemaId}, section ${section}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get all documentation for a schema
   * @param schemaId Schema ID
   * @returns Promise<SchemaDocumentation[]> Array of documentation
   */
  async getAllDocumentation(schemaId: string): Promise<SchemaDocumentation[]> {
    try {
      // Check if the schema_documentation table exists
      const tableExists = await this.checkIfTableExists("schema_documentation");
      if (!tableExists) {
        return [];
      }

      // Get all documentation for the schema
      const result = (await executeQuery(`
        SELECT id, schema_id, section, content, created_at, updated_at, created_by
        FROM schema_documentation
        WHERE schema_id = '${schemaId}'
        ORDER BY section
      `)) as Array<{
        id: string;
        schema_id: string;
        section: string;
        content: string;
        created_at: string;
        updated_at: string;
        created_by: string;
      }>;

      if (!result || result.length === 0) {
        return [];
      }

      // Convert to SchemaDocumentation objects
      return result.map((row) => {
        return {
          id: row.id,
          schemaId: row.schema_id,
          section: row.section,
          content: row.content,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          createdBy: row.created_by,
        };
      });
    } catch (error) {
      console.error(
        `[SchemaMetadataService] Error getting all documentation for schema ${schemaId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Delete documentation for a schema
   * @param schemaId Schema ID
   * @param section Documentation section
   * @returns Promise<boolean> True if deleted successfully
   */
  async deleteDocumentation(
    schemaId: string,
    section: string
  ): Promise<boolean> {
    try {
      // Check if the schema_documentation table exists
      const tableExists = await this.checkIfTableExists("schema_documentation");
      if (!tableExists) {
        return false;
      }

      // Delete the documentation
      await executeQuery(`
        DELETE FROM schema_documentation
        WHERE schema_id = '${schemaId}' AND section = '${section}'
      `);

      return true;
    } catch (error) {
      console.error(
        `[SchemaMetadataService] Error deleting documentation for schema ${schemaId}, section ${section}:`,
        error
      );
      return false;
    }
  }

  /**
   * Check if a table exists
   * @param tableName Table name
   * @returns Promise<boolean> True if the table exists
   */
  private async checkIfTableExists(tableName: string): Promise<boolean> {
    try {
      console.log(
        `[SchemaMetadataService] Checking if table ${tableName} exists`
      );

      const result = (await executeQuery(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = '${tableName}'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      const exists = result && result.length > 0 && result[0].exists;
      console.log(
        `[SchemaMetadataService] Table ${tableName} exists: ${exists}`
      );

      return exists;
    } catch (error) {
      console.error(
        `[SchemaMetadataService] Error checking if table ${tableName} exists:`,
        error
      );
      return false;
    }
  }
}

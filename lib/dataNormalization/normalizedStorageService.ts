import { executeQuery } from "../database";
import { v4 as uuidv4 } from "uuid";
import { GlobalSchema, SchemaColumn } from "../globalSchemaService";
import {
  NormalizedData,
  NormalizationResult,
} from "./dataNormalizationService";

/**
 * Storage architecture patterns
 */
export enum StorageArchitecturePattern {
  CENTRALIZED = "centralized",
  DECENTRALIZED = "decentralized",
  POLYGLOT = "polyglot",
}

/**
 * Interface for storage options
 */
export interface StorageOptions {
  architecturePattern: StorageArchitecturePattern;
  enableVersioning: boolean;
  enableHistorization: boolean;
  partitionStrategy?: PartitionStrategy;
  compressionEnabled?: boolean;
  retentionPolicy?: RetentionPolicy;
}

/**
 * Interface for partition strategy
 */
export interface PartitionStrategy {
  type: "time" | "hash" | "range" | "list";
  field: string;
  interval?: string; // For time partitioning (e.g., "day", "week", "month")
  ranges?: Array<{ min: any; max: any }>; // For range partitioning
  values?: any[]; // For list partitioning
}

/**
 * Interface for retention policy
 */
export interface RetentionPolicy {
  type: "time" | "version" | "size";
  value: number;
  unit?: string; // For time retention (e.g., "day", "week", "month")
}

/**
 * Interface for normalized record
 */
export interface NormalizedRecord {
  id: string;
  projectId: string;
  fileId: string;
  schemaId: string;
  data: any;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  previousVersionId?: string;
  partitionKey?: string;
  metadata?: Record<string, any>;
  history?: NormalizedRecordHistory[];
}

/**
 * Interface for normalized record history
 */
export interface NormalizedRecordHistory {
  id: string;
  recordId: string;
  projectId: string;
  fileId: string;
  schemaId: string;
  data: any;
  version: number;
  createdAt: Date;
  operation: string;
  changedBy?: string;
  changeReason?: string;
}

/**
 * Interface for query options
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
  filters?: Record<string, any>;
  includeInactive?: boolean;
  includeHistory?: boolean;
  version?: number;
  asOfDate?: Date;
}

/**
 * NormalizedStorageService class for storing and retrieving normalized data
 */
export class NormalizedStorageService {
  private defaultStorageOptions: StorageOptions = {
    architecturePattern: StorageArchitecturePattern.CENTRALIZED,
    enableVersioning: true,
    enableHistorization: true,
    compressionEnabled: false,
  };

  /**
   * Constructor
   * @param storageOptions Storage options
   */
  constructor(
    private storageOptions: StorageOptions = {
      architecturePattern: StorageArchitecturePattern.CENTRALIZED,
      enableVersioning: true,
      enableHistorization: true,
    }
  ) {
    this.storageOptions = { ...this.defaultStorageOptions, ...storageOptions };
  }

  /**
   * Initialize storage
   * @returns Promise<boolean> Success
   */
  async initializeStorage(): Promise<boolean> {
    try {
      // Create the normalized_records table if it doesn't exist
      const normalizedRecordsExists = await this.checkIfTableExists(
        "normalized_records"
      );
      if (!normalizedRecordsExists) {
        await executeQuery(`
          CREATE TABLE normalized_records (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            file_id TEXT NOT NULL,
            schema_id TEXT NOT NULL,
            data JSONB NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            previous_version_id TEXT,
            partition_key TEXT,
            metadata JSONB
          )
        `);

        // Create indexes
        await executeQuery(`
          CREATE INDEX idx_normalized_records_project_id ON normalized_records (project_id);
          CREATE INDEX idx_normalized_records_file_id ON normalized_records (file_id);
          CREATE INDEX idx_normalized_records_schema_id ON normalized_records (schema_id);
          CREATE INDEX idx_normalized_records_version ON normalized_records (version);
          CREATE INDEX idx_normalized_records_is_active ON normalized_records (is_active);
          CREATE INDEX idx_normalized_records_partition_key ON normalized_records (partition_key);
        `);
      }

      // Create the normalized_record_history table if historization is enabled
      if (this.storageOptions.enableHistorization) {
        const historyTableExists = await this.checkIfTableExists(
          "normalized_record_history"
        );
        if (!historyTableExists) {
          await executeQuery(`
            CREATE TABLE normalized_record_history (
              id TEXT PRIMARY KEY,
              record_id TEXT NOT NULL,
              project_id TEXT NOT NULL,
              file_id TEXT NOT NULL,
              schema_id TEXT NOT NULL,
              data JSONB NOT NULL,
              version INTEGER NOT NULL,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              operation TEXT NOT NULL,
              changed_by TEXT,
              change_reason TEXT
            )
          `);

          // Create indexes
          await executeQuery(`
            CREATE INDEX idx_normalized_record_history_record_id ON normalized_record_history (record_id);
            CREATE INDEX idx_normalized_record_history_project_id ON normalized_record_history (project_id);
            CREATE INDEX idx_normalized_record_history_file_id ON normalized_record_history (file_id);
            CREATE INDEX idx_normalized_record_history_schema_id ON normalized_record_history (schema_id);
            CREATE INDEX idx_normalized_record_history_version ON normalized_record_history (version);
          `);
        }
      }

      // Create the normalized_record_metadata table for polyglot storage
      if (
        this.storageOptions.architecturePattern ===
        StorageArchitecturePattern.POLYGLOT
      ) {
        const metadataTableExists = await this.checkIfTableExists(
          "normalized_record_metadata"
        );
        if (!metadataTableExists) {
          await executeQuery(`
            CREATE TABLE normalized_record_metadata (
              id TEXT PRIMARY KEY,
              record_id TEXT NOT NULL,
              storage_type TEXT NOT NULL,
              storage_location TEXT NOT NULL,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              metadata JSONB
            )
          `);

          // Create indexes
          await executeQuery(`
            CREATE INDEX idx_normalized_record_metadata_record_id ON normalized_record_metadata (record_id);
            CREATE INDEX idx_normalized_record_metadata_storage_type ON normalized_record_metadata (storage_type);
          `);
        }
      }

      return true;
    } catch (error) {
      console.error(
        "[NormalizedStorageService] Error initializing storage:",
        error
      );
      return false;
    }
  }

  /**
   * Store normalized data
   * @param projectId Project ID
   * @param fileId File ID
   * @param schemaId Schema ID
   * @param data Normalized data
   * @param options Storage options
   * @returns Promise<NormalizationResult> Normalization result
   */
  async storeNormalizedData(
    projectId: string,
    fileId: string,
    schemaId: string,
    data: any[],
    options?: Partial<StorageOptions>
  ): Promise<NormalizationResult> {
    try {
      console.log(
        "[NormalizedStorageService] Storing normalized data for file " +
          fileId +
          " in project " +
          projectId
      );

      // Merge options with defaults
      const mergedOptions = { ...this.storageOptions, ...options };

      // Initialize storage if needed
      await this.initializeStorage();

      // Get the schema to determine the version
      const schema = await this.getSchema(schemaId);
      if (!schema) {
        throw new Error("Schema " + schemaId + " not found");
      }

      // Process each data record
      const normalizedCount = data.length;
      const errors: Array<{
        rowIndex: number;
        column: string;
        value: any;
        error: string;
      }> = [];
      const warnings: Array<{
        rowIndex: number;
        column: string;
        value: any;
        warning: string;
      }> = [];

      for (const record of data) {
        try {
          // Generate a unique ID for the record
          const recordId = `record_${uuidv4()}`;

          // Generate partition key if a partition strategy is defined
          let partitionKey: string | undefined = undefined;
          if (mergedOptions.partitionStrategy) {
            partitionKey = this.generatePartitionKey(
              record,
              mergedOptions.partitionStrategy
            );
          }

          // Store the record based on the architecture pattern
          switch (mergedOptions.architecturePattern) {
            case StorageArchitecturePattern.CENTRALIZED:
              await this.storeCentralized(
                recordId,
                projectId,
                fileId,
                schemaId,
                record,
                schema.version,
                partitionKey
              );
              break;
            case StorageArchitecturePattern.DECENTRALIZED:
              await this.storeDecentralized(
                recordId,
                projectId,
                fileId,
                schemaId,
                record,
                schema.version,
                partitionKey
              );
              break;
            case StorageArchitecturePattern.POLYGLOT:
              await this.storePolyglot(
                recordId,
                projectId,
                fileId,
                schemaId,
                record,
                schema.version,
                partitionKey
              );
              break;
            default:
              throw new Error(
                `Unsupported architecture pattern: ${mergedOptions.architecturePattern}`
              );
          }
        } catch (error) {
          console.error(
            "[NormalizedStorageService] Error storing record:",
            error
          );
          errors.push({
            rowIndex: data.indexOf(record),
            column: "",
            value: record,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return {
        success: errors.length === 0,
        normalizedCount,
        errorCount: errors.length,
        errors,
        warnings,
      };
    } catch (error) {
      console.error(
        `[NormalizedStorageService] Error storing normalized data for file ${fileId}:`,
        error
      );
      return {
        success: false,
        normalizedCount: 0,
        errorCount: 1,
        errors: [
          {
            rowIndex: -1,
            column: "",
            value: null,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Store data using centralized architecture pattern
   * @param recordId Record ID
   * @param projectId Project ID
   * @param fileId File ID
   * @param schemaId Schema ID
   * @param data Record data
   * @param version Schema version
   * @param partitionKey Partition key
   * @returns Promise<void>
   */
  private async storeCentralized(
    recordId: string,
    projectId: string,
    fileId: string,
    schemaId: string,
    data: any,
    version: number,
    partitionKey?: string
  ): Promise<void> {
    // Store the record in the normalized_records table
    await executeQuery(`
      INSERT INTO normalized_records (
        id,
        project_id,
        file_id,
        schema_id,
        data,
        version,
        created_at,
        updated_at,
        is_active,
        partition_key
      )
      VALUES (
        '${recordId}',
        '${projectId}',
        '${fileId}',
        '${schemaId}',
        '${JSON.stringify(data)}',
        ${version},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        TRUE,
        ${partitionKey ? `'${partitionKey}'` : "NULL"}
      )
    `);

    // Add to history if historization is enabled
    if (this.storageOptions.enableHistorization) {
      const historyId = `history_${uuidv4()}`;
      await executeQuery(`
        INSERT INTO normalized_record_history (
          id,
          record_id,
          project_id,
          file_id,
          schema_id,
          data,
          version,
          created_at,
          operation
        )
        VALUES (
          '${historyId}',
          '${recordId}',
          '${projectId}',
          '${fileId}',
          '${schemaId}',
          '${JSON.stringify(data)}',
          ${version},
          CURRENT_TIMESTAMP,
          'INSERT'
        )
      `);
    }
  }

  /**
   * Store data using decentralized architecture pattern
   * @param recordId Record ID
   * @param projectId Project ID
   * @param fileId File ID
   * @param schemaId Schema ID
   * @param data Record data
   * @param version Schema version
   * @param partitionKey Partition key
   * @returns Promise<void>
   */
  private async storeDecentralized(
    recordId: string,
    projectId: string,
    fileId: string,
    schemaId: string,
    data: any,
    version: number,
    partitionKey?: string
  ): Promise<void> {
    // Get the schema to determine the table structure
    const schema = await this.getSchema(schemaId);
    if (!schema) {
      throw new Error(`Schema ${schemaId} not found`);
    }

    // Create a table for the schema if it doesn't exist
    const tableName = `normalized_data_${schemaId.replace(
      /[^a-zA-Z0-9_]/g,
      "_"
    )}`;
    const tableExists = await this.checkIfTableExists(tableName);

    if (!tableExists) {
      // Create a table with columns based on the schema
      let createTableSQL = `
        CREATE TABLE ${tableName} (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          file_id TEXT NOT NULL,
          schema_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          previous_version_id TEXT,
          partition_key TEXT,
      `;

      // Add columns based on schema
      for (const column of schema.columns) {
        let columnType = "TEXT";
        switch (column.type) {
          case "integer":
            columnType = "INTEGER";
            break;
          case "numeric":
            columnType = "NUMERIC";
            break;
          case "boolean":
            columnType = "BOOLEAN";
            break;
          case "timestamp":
            columnType = "TIMESTAMP";
            break;
          case "json":
            columnType = "JSONB";
            break;
          default:
            columnType = "TEXT";
        }

        createTableSQL += `${column.name.replace(
          /[^a-zA-Z0-9_]/g,
          "_"
        )} ${columnType}${column.isRequired ? " NOT NULL" : ""},\n`;
      }

      // Remove the trailing comma and close the statement
      createTableSQL = createTableSQL.slice(0, -2) + "\n)";

      // Create the table
      await executeQuery(createTableSQL);

      // Create indexes
      await executeQuery(`
        CREATE INDEX idx_${tableName}_project_id ON ${tableName} (project_id);
        CREATE INDEX idx_${tableName}_file_id ON ${tableName} (file_id);
        CREATE INDEX idx_${tableName}_version ON ${tableName} (version);
        CREATE INDEX idx_${tableName}_is_active ON ${tableName} (is_active);
        ${
          partitionKey
            ? `CREATE INDEX idx_${tableName}_partition_key ON ${tableName} (partition_key);`
            : ""
        }
      `);
    }

    // Prepare the insert statement
    let insertSQL = `
      INSERT INTO ${tableName} (
        id,
        project_id,
        file_id,
        schema_id,
        version,
        created_at,
        updated_at,
        is_active,
        partition_key,
    `;

    // Add column names
    const columnNames = [];
    const columnValues = [];
    for (const column of schema.columns) {
      const columnName = column.name.replace(/[^a-zA-Z0-9_]/g, "_");
      columnNames.push(columnName);

      // Get the value from the data
      const value = data[column.name];

      // Format the value based on the column type
      if (value === null || value === undefined) {
        columnValues.push("NULL");
      } else if (column.type === "text") {
        columnValues.push(`'${String(value).replace(/'/g, "''")}'`);
      } else if (column.type === "integer" || column.type === "numeric") {
        columnValues.push(String(value));
      } else if (column.type === "boolean") {
        columnValues.push(value ? "TRUE" : "FALSE");
      } else if (column.type === "timestamp") {
        columnValues.push(`'${new Date(value).toISOString()}'`);
      } else if (column.type === "json") {
        columnValues.push(`'${JSON.stringify(value)}'`);
      } else {
        columnValues.push(`'${String(value).replace(/'/g, "''")}'`);
      }
    }

    // Add column names to the insert statement
    insertSQL += columnNames.join(",\n") + ")\nVALUES (\n";

    // Add values
    insertSQL += `
      '${recordId}',
      '${projectId}',
      '${fileId}',
      '${schemaId}',
      ${version},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      TRUE,
      ${partitionKey ? `'${partitionKey}'` : "NULL"},
      ${columnValues.join(",\n")}
    )`;

    // Execute the insert
    await executeQuery(insertSQL);

    // Add to history if historization is enabled
    if (this.storageOptions.enableHistorization) {
      const historyId = `history_${uuidv4()}`;
      await executeQuery(`
        INSERT INTO normalized_record_history (
          id,
          record_id,
          project_id,
          file_id,
          schema_id,
          data,
          version,
          created_at,
          operation
        )
        VALUES (
          '${historyId}',
          '${recordId}',
          '${projectId}',
          '${fileId}',
          '${schemaId}',
          '${JSON.stringify(data)}',
          ${version},
          CURRENT_TIMESTAMP,
          'INSERT'
        )
      `);
    }
  }

  /**
   * Store data using polyglot architecture pattern
   * @param recordId Record ID
   * @param projectId Project ID
   * @param fileId File ID
   * @param schemaId Schema ID
   * @param data Record data
   * @param version Schema version
   * @param partitionKey Partition key
   * @returns Promise<void>
   */
  private async storePolyglot(
    recordId: string,
    projectId: string,
    fileId: string,
    schemaId: string,
    data: any,
    version: number,
    partitionKey?: string
  ): Promise<void> {
    // Store metadata in the normalized_records table
    await executeQuery(`
      INSERT INTO normalized_records (
        id,
        project_id,
        file_id,
        schema_id,
        data,
        version,
        created_at,
        updated_at,
        is_active,
        partition_key
      )
      VALUES (
        '${recordId}',
        '${projectId}',
        '${fileId}',
        '${schemaId}',
        '${JSON.stringify(data)}',
        ${version},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        TRUE,
        ${partitionKey ? `'${partitionKey}'` : "NULL"}
      )
    `);

    // Store metadata about the storage location
    const metadataId = `metadata_${uuidv4()}`;
    await executeQuery(`
      INSERT INTO normalized_record_metadata (
        id,
        record_id,
        storage_type,
        storage_location,
        created_at,
        updated_at,
        metadata
      )
      VALUES (
        '${metadataId}',
        '${recordId}',
        'postgresql',
        'normalized_records',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        '${JSON.stringify({
          version,
          schemaId,
          projectId,
          fileId,
        })}'
      )
    `);

    // Add to history if historization is enabled
    if (this.storageOptions.enableHistorization) {
      const historyId = `history_${uuidv4()}`;
      await executeQuery(`
        INSERT INTO normalized_record_history (
          id,
          record_id,
          project_id,
          file_id,
          schema_id,
          data,
          version,
          created_at,
          operation
        )
        VALUES (
          '${historyId}',
          '${recordId}',
          '${projectId}',
          '${fileId}',
          '${schemaId}',
          '${JSON.stringify(data)}',
          ${version},
          CURRENT_TIMESTAMP,
          'INSERT'
        )
      `);
    }
  }

  /**
   * Get normalized records for a project
   * @param projectId Project ID
   * @param options Query options
   * @returns Promise<NormalizedRecord[]> Normalized records
   */
  async getNormalizedRecords(
    projectId: string,
    options?: QueryOptions
  ): Promise<NormalizedRecord[]> {
    try {
      console.log(
        `[NormalizedStorageService] Getting normalized records for project ${projectId}`
      );

      // Initialize storage if needed
      await this.initializeStorage();

      // Build the query
      let query = `
        SELECT
          id,
          project_id as "projectId",
          file_id as "fileId",
          schema_id as "schemaId",
          data,
          version,
          created_at as "createdAt",
          updated_at as "updatedAt",
          is_active as "isActive",
          previous_version_id as "previousVersionId",
          partition_key as "partitionKey",
          metadata
        FROM normalized_records
        WHERE project_id = $1
      `;

      const queryParams = [projectId];
      let paramIndex = 2;

      // Add active filter
      if (!options?.includeInactive) {
        query += ` AND is_active = TRUE`;
      }

      // Add version filter
      if (options?.version) {
        query += ` AND version = $${paramIndex++}`;
        queryParams.push(String(options.version));
      }

      // Add as-of-date filter
      if (options?.asOfDate) {
        query += ` AND created_at <= $${paramIndex++}`;
        queryParams.push(options.asOfDate.toISOString());
      }

      // Add custom filters
      if (options?.filters && Object.keys(options.filters).length > 0) {
        for (const [field, value] of Object.entries(options.filters)) {
          if (value === null) {
            query += ` AND data->>'${field}' IS NULL`;
          } else if (typeof value === "object" && value !== null) {
            // Handle operator-based filters
            if ("eq" in value) {
              query += ` AND data->>'${field}' = $${paramIndex++}`;
              queryParams.push(value.eq);
            }
            if ("neq" in value) {
              query += ` AND data->>'${field}' != $${paramIndex++}`;
              queryParams.push(value.neq);
            }
            if ("gt" in value) {
              query += ` AND (data->>'${field}')::numeric > $${paramIndex++}`;
              queryParams.push(value.gt);
            }
            if ("gte" in value) {
              query += ` AND (data->>'${field}')::numeric >= $${paramIndex++}`;
              queryParams.push(value.gte);
            }
            if ("lt" in value) {
              query += ` AND (data->>'${field}')::numeric < $${paramIndex++}`;
              queryParams.push(value.lt);
            }
            if ("lte" in value) {
              query += ` AND (data->>'${field}')::numeric <= $${paramIndex++}`;
              queryParams.push(value.lte);
            }
            if ("contains" in value) {
              query += ` AND data->>'${field}' LIKE $${paramIndex++}`;
              queryParams.push(`%${value.contains}%`);
            }
            if ("startsWith" in value) {
              query += ` AND data->>'${field}' LIKE $${paramIndex++}`;
              queryParams.push(`${value.startsWith}%`);
            }
            if ("endsWith" in value) {
              query += ` AND data->>'${field}' LIKE $${paramIndex++}`;
              queryParams.push(`%${value.endsWith}`);
            }
            if ("in" in value && Array.isArray(value.in)) {
              const placeholders = value.in
                .map(() => `$${paramIndex++}`)
                .join(", ");
              query += ` AND data->>'${field}' IN (${placeholders})`;
              queryParams.push(...value.in);
            }
          } else {
            // Simple equality filter
            query += ` AND data->>'${field}' = $${paramIndex++}`;
            queryParams.push(value);
          }
        }
      }

      // Add order by
      if (options?.orderBy) {
        query += ` ORDER BY data->>'${options.orderBy}' ${
          options.orderDirection || "ASC"
        }`;
      } else {
        query += ` ORDER BY created_at DESC`;
      }

      // Add limit and offset
      if (options?.limit) {
        query += ` LIMIT $${paramIndex++}`;
        queryParams.push(String(options.limit));

        if (options.offset) {
          query += ` OFFSET $${paramIndex++}`;
          queryParams.push(String(options.offset));
        }
      }

      // Execute the query
      const result = await executeQuery(query, queryParams);
      const records = result.rows;

      // Add history if requested
      if (options?.includeHistory && records.length > 0) {
        for (const record of records) {
          const historyQuery = `
            SELECT
              id,
              record_id as "recordId",
              project_id as "projectId",
              file_id as "fileId",
              schema_id as "schemaId",
              data,
              version,
              created_at as "createdAt",
              operation,
              changed_by as "changedBy",
              change_reason as "changeReason"
            FROM normalized_record_history
            WHERE record_id = $1
            ORDER BY created_at DESC
          `;

          const historyResult = await executeQuery(historyQuery, [record.id]);
          record.history = historyResult.rows;
        }
      }

      return records;
    } catch (error) {
      console.error(
        `[NormalizedStorageService] Error getting normalized records for project ${projectId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get normalized records for a file
   * @param fileId File ID
   * @param options Query options
   * @returns Promise<NormalizedRecord[]> Normalized records
   */
  async getNormalizedRecordsForFile(
    fileId: string,
    options?: QueryOptions
  ): Promise<NormalizedRecord[]> {
    try {
      console.log(
        `[NormalizedStorageService] Getting normalized records for file ${fileId}`
      );

      // Initialize storage if needed
      await this.initializeStorage();

      // Build the query
      let query = `
        SELECT
          id,
          project_id as "projectId",
          file_id as "fileId",
          schema_id as "schemaId",
          data,
          version,
          created_at as "createdAt",
          updated_at as "updatedAt",
          is_active as "isActive",
          previous_version_id as "previousVersionId",
          partition_key as "partitionKey",
          metadata
        FROM normalized_records
        WHERE file_id = $1
      `;

      const queryParams = [fileId];
      let paramIndex = 2;

      // Add active filter
      if (!options?.includeInactive) {
        query += ` AND is_active = TRUE`;
      }

      // Add version filter
      if (options?.version) {
        query += ` AND version = $${paramIndex++}`;
        queryParams.push(String(options.version));
      }

      // Add as-of-date filter
      if (options?.asOfDate) {
        query += ` AND created_at <= $${paramIndex++}`;
        queryParams.push(options.asOfDate.toISOString());
      }

      // Add custom filters
      if (options?.filters && Object.keys(options.filters).length > 0) {
        for (const [field, value] of Object.entries(options.filters)) {
          if (value === null) {
            query += ` AND data->>'${field}' IS NULL`;
          } else if (typeof value === "object" && value !== null) {
            // Handle operator-based filters
            if ("eq" in value) {
              query += ` AND data->>'${field}' = $${paramIndex++}`;
              queryParams.push(value.eq);
            }
            if ("neq" in value) {
              query += ` AND data->>'${field}' != $${paramIndex++}`;
              queryParams.push(value.neq);
            }
            if ("gt" in value) {
              query += ` AND (data->>'${field}')::numeric > $${paramIndex++}`;
              queryParams.push(value.gt);
            }
            if ("gte" in value) {
              query += ` AND (data->>'${field}')::numeric >= $${paramIndex++}`;
              queryParams.push(value.gte);
            }
            if ("lt" in value) {
              query += ` AND (data->>'${field}')::numeric < $${paramIndex++}`;
              queryParams.push(value.lt);
            }
            if ("lte" in value) {
              query += ` AND (data->>'${field}')::numeric <= $${paramIndex++}`;
              queryParams.push(value.lte);
            }
            if ("contains" in value) {
              query += ` AND data->>'${field}' LIKE $${paramIndex++}`;
              queryParams.push(`%${value.contains}%`);
            }
            if ("startsWith" in value) {
              query += ` AND data->>'${field}' LIKE $${paramIndex++}`;
              queryParams.push(`${value.startsWith}%`);
            }
            if ("endsWith" in value) {
              query += ` AND data->>'${field}' LIKE $${paramIndex++}`;
              queryParams.push(`%${value.endsWith}`);
            }
            if ("in" in value && Array.isArray(value.in)) {
              const placeholders = value.in
                .map(() => `$${paramIndex++}`)
                .join(", ");
              query += ` AND data->>'${field}' IN (${placeholders})`;
              queryParams.push(...value.in);
            }
          } else {
            // Simple equality filter
            query += ` AND data->>'${field}' = $${paramIndex++}`;
            queryParams.push(value);
          }
        }
      }

      // Add order by
      if (options?.orderBy) {
        query += ` ORDER BY data->>'${options.orderBy}' ${
          options.orderDirection || "ASC"
        }`;
      } else {
        query += ` ORDER BY created_at DESC`;
      }

      // Add limit and offset
      if (options?.limit) {
        query += ` LIMIT $${paramIndex++}`;
        queryParams.push(String(options.limit));

        if (options.offset) {
          query += ` OFFSET $${paramIndex++}`;
          queryParams.push(String(options.offset));
        }
      }

      // Execute the query
      const result = await executeQuery(query, queryParams);
      const records = result.rows;

      // Add history if requested
      if (options?.includeHistory && records.length > 0) {
        for (const record of records) {
          const historyQuery = `
            SELECT
              id,
              record_id as "recordId",
              project_id as "projectId",
              file_id as "fileId",
              schema_id as "schemaId",
              data,
              version,
              created_at as "createdAt",
              operation,
              changed_by as "changedBy",
              change_reason as "changeReason"
            FROM normalized_record_history
            WHERE record_id = $1
            ORDER BY created_at DESC
          `;

          const historyResult = await executeQuery(historyQuery, [record.id]);
          record.history = historyResult.rows;
        }
      }

      return records;
    } catch (error) {
      console.error(
        `[NormalizedStorageService] Error getting normalized records for file ${fileId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get schema by ID
   * @param schemaId Schema ID
   * @returns Promise<GlobalSchema | null> Schema
   */
  private async getSchema(schemaId: string): Promise<any> {
    try {
      const query = `
        SELECT
          id,
          name,
          description,
          project_id as "projectId",
          version,
          created_at as "createdAt",
          updated_at as "updatedAt",
          is_active as "isActive"
        FROM global_schemas
        WHERE id = $1
      `;

      const result = await executeQuery(query, [schemaId]);

      if (!result || result.rows.length === 0) {
        return null;
      }

      const schema = result.rows[0];

      // Get schema columns
      const columnsQuery = `
        SELECT
          id,
          schema_id as "schemaId",
          name,
          description,
          type,
          is_required as "isRequired",
          is_unique as "isUnique",
          default_value as "defaultValue",
          validation_rules as "validationRules",
          created_at as "createdAt",
          updated_at as "updatedAt",
          is_active as "isActive",
          display_order as "displayOrder"
        FROM global_schema_columns
        WHERE schema_id = $1
        ORDER BY display_order ASC, name ASC
      `;

      const columnsResult = await executeQuery(columnsQuery, [schemaId]);

      if (columnsResult && columnsResult.rows.length > 0) {
        schema.columns = columnsResult.rows;
      } else {
        schema.columns = [];
      }

      return schema;
    } catch (error) {
      console.error(
        `[NormalizedStorageService] Error getting schema ${schemaId}:`,
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
  private async checkIfTableExists(tableName: string): Promise<boolean> {
    try {
      const query = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        ) as exists
      `;

      const result = await executeQuery(query, [tableName]);
      return result.rows[0].exists;
    } catch (error) {
      console.error(
        `[NormalizedStorageService] Error checking if table ${tableName} exists:`,
        error
      );
      throw error;
    }
  }

  /**
   * Generate partition key
   * @param data Record data
   * @param strategy Partition strategy
   * @returns string Partition key
   */
  private generatePartitionKey(data: any, strategy: PartitionStrategy): string {
    const field = strategy.field;
    const value = data[field];

    if (value === undefined) {
      return "default";
    }

    switch (strategy.type) {
      case "time":
        const date = new Date(value);
        const interval = strategy.interval || "day";

        switch (interval) {
          case "day":
            return `${date.getFullYear()}-${
              date.getMonth() + 1
            }-${date.getDate()}`;
          case "week":
            const firstDayOfWeek = new Date(date);
            const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? -6 : 1);
            firstDayOfWeek.setDate(diff);
            return `${firstDayOfWeek.getFullYear()}-${
              firstDayOfWeek.getMonth() + 1
            }-${firstDayOfWeek.getDate()}`;
          case "month":
            return `${date.getFullYear()}-${date.getMonth() + 1}`;
          case "year":
            return `${date.getFullYear()}`;
          default:
            return `${date.getFullYear()}-${
              date.getMonth() + 1
            }-${date.getDate()}`;
        }

      case "hash":
        // Simple hash function
        const hash = Array.from(String(value))
          .reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0), 0)
          .toString(16);
        return hash;

      case "range":
        if (!strategy.ranges || !strategy.ranges.length) {
          return "default";
        }

        for (let i = 0; i < strategy.ranges.length; i++) {
          const range = strategy.ranges[i];
          if (value >= range.min && value <= range.max) {
            return `range_${i}`;
          }
        }
        return "default";

      case "list":
        if (!strategy.values || !strategy.values.length) {
          return "default";
        }

        const index = strategy.values.indexOf(value);
        return index >= 0 ? `list_${index}` : "default";

      default:
        return "default";
    }
  }
}

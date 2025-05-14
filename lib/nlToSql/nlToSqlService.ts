import { createLLMService, LLMService } from "./llmService";
import { createSchemaService, SchemaService } from "./schemaService";
import { createQueryService, QueryService } from "./queryService";
import { activateAvailableFiles } from "../fileActivation";
import { executeQuery } from "../database";
import {
  SchemaService as SchemaManagementService,
  GlobalSchema,
} from "../schemaManagement";

// Import DatabaseSchema interface from schemaService or define it here
interface Table {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
  }>;
  rowCount: number;
}

interface DatabaseSchema {
  tables: Table[];
}

// Define the interface for the NL-to-SQL service configuration
interface NLToSQLServiceConfig {
  apiKey?: string;
  model?: string;
}

// Import ViewState interface from viewStateManager
import { ViewState } from "../viewStateManager";

// Define the interface for the NL-to-SQL service response
interface NLToSQLResponse {
  sqlQuery: string;
  explanation: string;
  results: Record<string, unknown>[];
  error?: string;
  executionTime?: number;
  totalRows?: number;
  totalPages?: number;
  currentPage?: number;
  columnMerges?: {
    id: string;
    mergeName: string;
    columnList: string[];
    delimiter: string;
  }[];
}

// Define the interface for query options
interface QueryOptions {
  page?: number;
  pageSize?: number;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  filters?: Record<string, unknown>;
  viewState?: string; // Serialized ViewState
  schemaId?: string; // Global schema ID
}

// Define the interface for query history item
interface QueryHistoryItem {
  id: string;
  query: string;
  sqlQuery: string;
  timestamp: Date;
  status?: string;
  executionTime?: number;
  error?: string;
}

/**
 * NLToSQLService class for coordinating between the LLM, schema, and query services
 * This service is responsible for translating natural language queries to SQL and executing them
 */
export class NLToSQLService {
  private llmService: LLMService;
  private schemaService: SchemaService;
  private queryService: QueryService;
  private schemaManagementService: SchemaManagementService;

  /**
   * Constructor for the NLToSQLService
   * @param config Configuration for the NL-to-SQL service
   */
  constructor(config: NLToSQLServiceConfig = {}) {
    // Create default LLM service configuration
    const llmConfig = {
      model: config.model || "gpt-4",
      temperature: 0.1,
      maxTokens: 1500,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
    };

    // Ensure API key is provided or use a default (which should be overridden in production)
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY || "";

    this.llmService = createLLMService(apiKey, llmConfig);
    this.schemaService = createSchemaService();
    this.queryService = createQueryService();
    this.schemaManagementService = new SchemaManagementService();
  }

  /**
   * Process a natural language query
   * @param query Natural language query
   * @param userId User ID
   * @returns Promise<NLToSQLResponse> SQL query, explanation, and results
   */
  async processQuery(
    query: string,
    userId: string,
    options: QueryOptions = {}
  ): Promise<NLToSQLResponse> {
    // Parse view state if provided
    let viewState: ViewState | undefined;
    if (options.viewState) {
      try {
        viewState = JSON.parse(options.viewState) as ViewState;
        console.log(
          `[NLToSQLService] Received view state with ${viewState.virtualColumns.length} virtual columns`
        );
      } catch (error) {
        console.error("[NLToSQLService] Error parsing view state:", error);
      }
    }

    // Get global schema if provided
    let globalSchema: GlobalSchema | null = null;
    if (options.schemaId) {
      try {
        globalSchema = await this.schemaManagementService.getGlobalSchemaById(
          options.schemaId
        );
        console.log(
          `[NLToSQLService] Retrieved global schema: ${globalSchema?.name} with ${globalSchema?.columns.length} columns`
        );
      } catch (error) {
        console.error(
          "[NLToSQLService] Error retrieving global schema:",
          error
        );
      }
    }

    try {
      console.log(
        `[NLToSQLService] Processing query for user ${userId}: "${query}"`
      );
      console.log(`[NLToSQLService] Query options:`, JSON.stringify(options));

      // Get schema information for all active tables
      console.log(
        `[NLToSQLService] Fetching schema for active tables for user ${userId}`
      );
      const schema = await this.schemaService.getSchemaForActiveTables(userId);
      console.log(
        `[NLToSQLService] Retrieved schema with ${
          schema.tables?.length || 0
        } tables`
      );

      // Check if there are no active tables
      if (!schema.tables || schema.tables.length === 0) {
        console.log(
          `[NLToSQLService] No active tables found for user: ${userId}`
        );
        console.log(
          `[NLToSQLService] Active tables check: schema.tables=${!!schema.tables}, length=${
            schema.tables?.length || 0
          }`
        );

        // Try to auto-activate available files
        console.log(
          `[NLToSQLService] Attempting to auto-activate files for user ${userId}`
        );
        const activationResult = await activateAvailableFiles(userId);
        console.log(
          `[NLToSQLService] Auto-activation result:`,
          activationResult
        );

        if (activationResult.activatedCount > 0) {
          // If files were activated, try to get schema again
          console.log(
            `[NLToSQLService] Successfully activated ${activationResult.activatedCount} files, fetching schema again`
          );
          const updatedSchema =
            await this.schemaService.getSchemaForActiveTables(userId);

          if (updatedSchema.tables && updatedSchema.tables.length > 0) {
            console.log(
              `[NLToSQLService] Retrieved updated schema with ${updatedSchema.tables.length} tables after auto-activation`
            );

            // Format the schema information for the LLM prompt
            console.log(
              `[NLToSQLService] Formatting schema for prompt with ${updatedSchema.tables.length} tables`
            );
            const schemaInfo = await this.schemaService.formatSchemaForPrompt(
              updatedSchema
            );
            console.log(
              `[NLToSQLService] Schema info for prompt (length: ${schemaInfo.length} chars)`
            );

            // Continue with the query processing
            return this.processQueryWithSchema(
              query,
              userId,
              updatedSchema,
              options,
              viewState,
              globalSchema
            );
          }
        }

        // If we still don't have tables after auto-activation attempt, try to get file data directly
        console.log(
          `[NLToSQLService] Still no active tables, trying to get file data directly`
        );

        try {
          // Check if there's any file data
          const fileDataResult = (await executeQuery(`
            SELECT COUNT(*) as count FROM file_data
          `)) as Array<{ count: number }>;

          if (
            fileDataResult &&
            fileDataResult.length > 0 &&
            fileDataResult[0].count > 0
          ) {
            console.log(
              `[NLToSQLService] Found ${fileDataResult[0].count} file data records, creating a generic schema`
            );

            // Get a sample of the data
            const sampleData = (await executeQuery(`
              SELECT data FROM file_data LIMIT 1
            `)) as Array<Record<string, unknown>>;

            if (sampleData && sampleData.length > 0) {
              // Create a generic table schema
              const genericTable = {
                name: "file_data",
                columns: [
                  {
                    name: "data",
                    type: "JSONB",
                    nullable: false,
                    isPrimaryKey: false,
                    isForeignKey: false,
                  },
                ],
                rowCount: fileDataResult[0].count,
                viewName: "file_data",
              };

              const updatedSchema = { tables: [genericTable] };
              console.log(
                `[NLToSQLService] Created generic schema with file_data table`
              );

              // Continue with the query processing using the generic schema
              return this.processQueryWithSchema(
                query,
                userId,
                updatedSchema,
                options,
                viewState,
                globalSchema
              );
            }
          }
        } catch (directAccessError) {
          console.error(
            `[NLToSQLService] Error getting file data directly:`,
            directAccessError
          );
        }

        // If we still can't get any data, return an error
        // For non-SELECT queries, we want to include the original query in the response
        const isSelectQuery = query.trim().toUpperCase().startsWith("SELECT");

        return {
          sqlQuery: isSelectQuery ? "" : query, // Include the query for non-SELECT queries
          explanation: "",
          results: [],
          error:
            "No active data files found. Please upload a file on the Upload page and ensure it's properly processed. If you've already uploaded files, try activating them manually from the Files page.",
        };
      }

      // Format the schema information for the LLM prompt
      console.log(
        `[NLToSQLService] Formatting schema for prompt with ${schema.tables.length} tables`
      );
      const schemaInfo = await this.schemaService.formatSchemaForPrompt(schema);
      console.log(
        `[NLToSQLService] Schema info for prompt (length: ${schemaInfo.length} chars)`
      );

      // Continue with the query processing
      return this.processQueryWithSchema(
        query,
        userId,
        schema,
        options,
        viewState,
        globalSchema
      );
    } catch (error) {
      console.error(
        "[NLToSQLService] Error processing natural language query:",
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[NLToSQLService] Error details: ${errorMessage}`);
      return {
        sqlQuery: "",
        explanation: "",
        results: [],
        error: errorMessage,
      };
    }
  }

  /**
   * Process a query with a given schema
   * @param query Natural language query
   * @param userId User ID
   * @param schema Database schema
   * @param options Query options
   * @returns Promise<NLToSQLResponse> SQL query, explanation, and results
   */
  private async processQueryWithSchema(
    query: string,
    userId: string,
    schema: DatabaseSchema,
    options: QueryOptions = {},
    viewState?: ViewState,
    globalSchema?: GlobalSchema | null
  ): Promise<NLToSQLResponse> {
    try {
      // Translate the natural language query to SQL
      console.log(`[NLToSQLService] Sending query to LLM service: "${query}"`);
      const schemaInfo = await this.schemaService.formatSchemaForPrompt(schema);

      // Try to get sample data for the first table to provide context
      let sampleData = "";
      if (schema.tables && schema.tables.length > 0) {
        const table = schema.tables[0];
        const fileIdMatch = table.name.match(/file_([a-f0-9-]+)$/);
        let viewName = "";

        if (fileIdMatch && fileIdMatch[1]) {
          viewName = `user_t_mrcto_ai_file_${fileIdMatch[1]}`;
        } else {
          viewName = `"${table.name.replace(/[^a-zA-Z0-9_]/g, "_")}"`;
        }

        try {
          sampleData = await this.schemaService.getSampleData(viewName, 3);
          console.log(`[NLToSQLService] Retrieved sample data for ${viewName}`);
        } catch (sampleError) {
          console.error(
            `[NLToSQLService] Error getting sample data:`,
            sampleError
          );
          // Continue without sample data
        }
      }

      // Pass the query directly to the LLM without any preprocessing
      // The LLM will use its own intelligence to determine the best approach
      // based on the comprehensive system prompt we've provided
      // Enhance the query with view state context if available
      let enhancedQuery = query;

      if (viewState && viewState.virtualColumns.length > 0) {
        // Add context about virtual columns to the query
        const virtualColumnsContext = viewState.virtualColumns
          .map(
            (vc) =>
              `Virtual column "${vc.name}" is defined as: ${vc.expression}`
          )
          .join(". ");
        enhancedQuery = `${query}\n\nContext: ${virtualColumnsContext}`;
        console.log(
          `[NLToSQLService] Enhanced query with virtual columns context`
        );
      }

      // Add global schema context if available
      let globalSchemaContext = "";
      if (globalSchema) {
        globalSchemaContext = `\n\nGlobal Schema "${globalSchema.name}":\n`;
        globalSchemaContext += globalSchema.columns
          .map(
            (col) =>
              `- ${col.name} (${col.type})${
                col.isRequired ? " (Required)" : ""
              }`
          )
          .join("\n");

        enhancedQuery = `${enhancedQuery}\n\n${globalSchemaContext}`;
        console.log(
          `[NLToSQLService] Enhanced query with global schema context`
        );
      }

      // Generate SQL from the natural language query
      const { sql: sqlQuery, explanation } =
        await this.llmService.translateToSQL(
          enhancedQuery,
          schemaInfo,
          sampleData
        );

      console.log(`[NLToSQLService] Generated SQL query: ${sqlQuery}`);
      console.log(
        `[NLToSQLService] Generated explanation: ${explanation.substring(
          0,
          100
        )}...`
      );

      // Execute the SQL query with pagination, sorting, and filtering
      console.log(
        `[NLToSQLService] Executing SQL query with options:`,
        options
      );
      const startTime = Date.now();
      const queryResult = await this.queryService.executeQuery(
        sqlQuery,
        userId,
        query,
        {
          page: options.page || 1,
          pageSize: options.pageSize || 25,
          sortColumn: options.sortColumn,
          sortDirection: options.sortDirection,
          filters: options.filters,
        }
      );
      const executionTime = Date.now() - startTime;
      console.log(
        `[NLToSQLService] Query executed in ${executionTime}ms, returned ${
          queryResult.rows?.length || 0
        } rows`
      );

      // Save the query to history
      try {
        await this.saveQueryToHistory(
          userId,
          query,
          sqlQuery,
          executionTime,
          queryResult.error
        );
      } catch (historyError) {
        console.error(
          `[NLToSQLService] Error saving query to history:`,
          historyError
        );
        // Continue without saving to history
      }

      // Return the SQL query, explanation, and results
      return {
        sqlQuery,
        explanation,
        results: queryResult.rows || [],
        executionTime,
        totalRows: queryResult.totalRows,
        totalPages: queryResult.totalPages,
        currentPage: queryResult.currentPage,
        error: queryResult.error,
      };
    } catch (error) {
      console.error(
        "[NLToSQLService] Error processing query with schema:",
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[NLToSQLService] Error details: ${errorMessage}`);
      return {
        sqlQuery: "",
        explanation: "",
        results: [],
        error: errorMessage,
      };
    }
  }

  /**
   * Get query history for a user
   * @param userId User ID
   * @param limit Maximum number of history items to return
   * @returns Promise<QueryHistoryItem[]> Query history items
   */
  async getQueryHistory(
    userId: string,
    limit: number = 10
  ): Promise<QueryHistoryItem[]> {
    try {
      console.log(
        `[NLToSQLService] Getting query history for user ${userId}, limit: ${limit}`
      );

      // Check if the queries table exists
      const tableExists = await this.checkIfTableExists("queries");
      if (!tableExists) {
        console.log(
          `[NLToSQLService] Queries table does not exist, returning empty history`
        );
        return [];
      }

      // Check if the nl_query column exists
      let columnExists = false;
      try {
        const columnCheck = (await executeQuery(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'queries' AND column_name = 'nl_query'
        `)) as Array<{ column_name: string }>;
        columnExists = Array.isArray(columnCheck) && columnCheck.length > 0;
      } catch (error) {
        console.error(
          "[NLToSQLService] Error checking column existence:",
          error
        );
      }

      // Get the query history from the database using the appropriate column name
      const columnName = columnExists ? "nl_query" : "query";
      console.log(
        `[NLToSQLService] Using column name: ${columnName} for query history`
      );

      const result = (await executeQuery(`
        SELECT id, user_id, ${columnName}, sql_query, status, execution_time, error, created_at
        FROM queries
        WHERE user_id = '${userId}'
        ORDER BY created_at DESC
        LIMIT ${limit}
      `)) as Array<{
        id: string;
        user_id: string;
        query?: string;
        nl_query?: string;
        sql_query: string;
        status: string;
        execution_time: number;
        error: string | null;
        created_at: string;
      }>;

      // Convert the result to QueryHistoryItem objects
      const history: QueryHistoryItem[] = (result || []).map((item) => ({
        id: item.id,
        query: item.nl_query || item.query || "",
        sqlQuery: item.sql_query,
        timestamp: new Date(item.created_at),
        status: item.status,
        executionTime: item.execution_time,
        error: item.error || undefined,
      }));

      console.log(
        `[NLToSQLService] Found ${history.length} history items for user ${userId}`
      );
      return history;
    } catch (error) {
      console.error("[NLToSQLService] Error getting query history:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[NLToSQLService] Error details: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Save a query to the history
   * @param userId User ID
   * @param query Natural language query
   * @param sqlQuery Generated SQL query
   * @param executionTime Query execution time in milliseconds
   * @param error Error message if the query failed
   */
  private async saveQueryToHistory(
    userId: string,
    query: string,
    sqlQuery: string,
    executionTime: number,
    error?: string
  ): Promise<void> {
    try {
      console.log(
        `[NLToSQLService] Saving query to history for user ${userId}`
      );

      // Check if the queries table exists
      const tableExists = await this.checkIfTableExists("queries");
      if (!tableExists) {
        console.log(
          `[NLToSQLService] Queries table does not exist, creating it`
        );
        await executeQuery(`
          CREATE TABLE queries (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            nl_query TEXT NOT NULL,
            sql_query TEXT NOT NULL,
            status TEXT NOT NULL,
            execution_time INTEGER,
            error TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }

      // Generate a unique ID for the query
      const queryId = `query_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 15)}`;

      // Save the query to the database
      await executeQuery(`
        INSERT INTO queries (id, user_id, nl_query, sql_query, status, execution_time, error, created_at)
        VALUES (
          '${queryId}',
          '${userId}',
          '${query.replace(/'/g, "''")}',
          '${sqlQuery.replace(/'/g, "''")}',
          '${error ? "error" : "success"}',
          ${executionTime},
          ${error ? `'${error.replace(/'/g, "''")}'` : "NULL"},
          CURRENT_TIMESTAMP
        )
      `);

      console.log(`[NLToSQLService] Query saved to history with ID ${queryId}`);
    } catch (error) {
      console.error("[NLToSQLService] Error saving query to history:", error);
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
      console.log(`[NLToSQLService] Checking if table ${tableName} exists`);

      const result = (await executeQuery(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = '${tableName}'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      const exists = result && result.length > 0 && result[0].exists;
      console.log(`[NLToSQLService] Table ${tableName} exists: ${exists}`);

      return exists;
    } catch (error) {
      console.error(
        `[NLToSQLService] Error checking if table ${tableName} exists:`,
        error
      );
      return false;
    }
  }
}

/**
 * Create a new NLToSQLService instance
 * @param config Configuration for the NL-to-SQL service
 * @returns NLToSQLService instance
 */
export function createNLToSQLService(
  config: NLToSQLServiceConfig = {}
): NLToSQLService {
  return new NLToSQLService(config);
}

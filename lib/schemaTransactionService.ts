import { executeQuery } from "./database";
import { v4 as uuidv4 } from "uuid";
import { GlobalSchema } from "./globalSchemaService";

/**
 * Interface for schema transaction
 */
export interface SchemaTransaction {
  id: string;
  schemaId: string;
  userId: string;
  status: "pending" | "committed" | "rolled_back" | "failed";
  operations: SchemaOperation[];
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  lockId?: string;
}

/**
 * Interface for schema operation
 */
export interface SchemaOperation {
  type: "add_column" | "remove_column" | "modify_column" | "update_schema";
  target: string;
  params: any;
  order: number;
  status: "pending" | "completed" | "failed";
  errorMessage?: string;
}

/**
 * Interface for transaction options
 */
export interface TransactionOptions {
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

/**
 * Interface for transaction result
 */
export interface TransactionResult {
  success: boolean;
  transactionId: string;
  message: string;
  schema?: GlobalSchema;
}

/**
 * SchemaTransactionService class for managing schema transactions
 */
export class SchemaTransactionService {
  private defaultOptions: TransactionOptions = {
    timeout: 30000, // 30 seconds
    retryCount: 3,
    retryDelay: 1000, // 1 second
  };

  /**
   * Begin a schema transaction
   * @param schemaId Schema ID
   * @param userId User ID
   * @param options Transaction options
   * @returns Promise<SchemaTransaction> Created transaction
   */
  async beginTransaction(
    schemaId: string,
    userId: string,
    options?: TransactionOptions
  ): Promise<SchemaTransaction> {
    try {
      // Check if the schema_transactions table exists
      const tableExists = await this.checkIfTableExists("schema_transactions");

      if (!tableExists) {
        // Create the table if it doesn't exist
        await executeQuery(`
          CREATE TABLE schema_transactions (
            id TEXT PRIMARY KEY,
            schema_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            status TEXT NOT NULL,
            operations JSONB NOT NULL,
            started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            error_message TEXT,
            lock_id TEXT
          )
        `);
      }

      // Create a lock ID for this transaction
      const lockId = `lock_${uuidv4()}`;

      // Try to acquire a lock on the schema
      const lockAcquired = await this.acquireLock(schemaId, lockId, options);

      if (!lockAcquired) {
        throw new Error(`Could not acquire lock on schema ${schemaId}`);
      }

      // Create the transaction
      const transactionId = `transaction_${uuidv4()}`;
      const transaction: SchemaTransaction = {
        id: transactionId,
        schemaId,
        userId,
        status: "pending",
        operations: [],
        startedAt: new Date(),
        lockId,
      };

      // Store the transaction in the database
      await executeQuery(`
        INSERT INTO schema_transactions (
          id, 
          schema_id, 
          user_id, 
          status, 
          operations, 
          started_at,
          lock_id
        )
        VALUES (
          '${transaction.id}',
          '${transaction.schemaId}',
          '${transaction.userId}',
          '${transaction.status}',
          '${JSON.stringify(transaction.operations)}',
          CURRENT_TIMESTAMP,
          '${lockId}'
        )
      `);

      return transaction;
    } catch (error) {
      console.error(
        "[SchemaTransactionService] Error beginning transaction:",
        error
      );
      throw error;
    }
  }

  /**
   * Add an operation to a transaction
   * @param transactionId Transaction ID
   * @param operation Schema operation
   * @returns Promise<SchemaTransaction> Updated transaction
   */
  async addOperation(
    transactionId: string,
    operation: Omit<SchemaOperation, "order" | "status">
  ): Promise<SchemaTransaction> {
    try {
      // Get the transaction
      const transaction = await this.getTransaction(transactionId);

      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      if (transaction.status !== "pending") {
        throw new Error(
          `Cannot add operation to transaction with status ${transaction.status}`
        );
      }

      // Add the operation
      const newOperation: SchemaOperation = {
        ...operation,
        order: transaction.operations.length,
        status: "pending",
      };

      transaction.operations.push(newOperation);

      // Update the transaction in the database
      await executeQuery(`
        UPDATE schema_transactions
        SET operations = '${JSON.stringify(transaction.operations)}'
        WHERE id = '${transactionId}'
      `);

      return transaction;
    } catch (error) {
      console.error(
        `[SchemaTransactionService] Error adding operation to transaction ${transactionId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Commit a transaction
   * @param transactionId Transaction ID
   * @returns Promise<TransactionResult> Transaction result
   */
  async commitTransaction(transactionId: string): Promise<TransactionResult> {
    try {
      // Get the transaction
      const transaction = await this.getTransaction(transactionId);

      if (!transaction) {
        return {
          success: false,
          transactionId,
          message: `Transaction ${transactionId} not found`,
        };
      }

      if (transaction.status !== "pending") {
        return {
          success: false,
          transactionId,
          message: `Cannot commit transaction with status ${transaction.status}`,
        };
      }

      // Execute the operations
      let success = true;
      let errorMessage = "";

      for (const operation of transaction.operations) {
        try {
          // Execute the operation
          await this.executeOperation(transaction.schemaId, operation);

          // Mark the operation as completed
          operation.status = "completed";
        } catch (error) {
          // Mark the operation as failed
          operation.status = "failed";
          operation.errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          success = false;
          errorMessage = operation.errorMessage;
          break;
        }
      }

      // Update the transaction status
      transaction.status = success ? "committed" : "failed";
      transaction.completedAt = new Date();
      if (!success) {
        transaction.errorMessage = errorMessage;
      }

      // Update the transaction in the database
      await executeQuery(`
        UPDATE schema_transactions
        SET 
          status = '${transaction.status}',
          operations = '${JSON.stringify(transaction.operations)}',
          completed_at = CURRENT_TIMESTAMP,
          error_message = ${
            transaction.errorMessage ? `'${transaction.errorMessage}'` : "NULL"
          }
        WHERE id = '${transactionId}'
      `);

      // Release the lock
      if (transaction.lockId) {
        await this.releaseLock(transaction.schemaId, transaction.lockId);
      }

      // Get the updated schema if successful
      let schema: GlobalSchema | undefined = undefined;
      if (success) {
        const updatedSchema = await this.getSchema(transaction.schemaId);
        if (updatedSchema) {
          schema = updatedSchema;
        }
      }

      return {
        success,
        transactionId,
        message: success
          ? "Transaction committed successfully"
          : `Transaction failed: ${errorMessage}`,
        schema,
      };
    } catch (error) {
      console.error(
        `[SchemaTransactionService] Error committing transaction ${transactionId}:`,
        error
      );

      // Try to release the lock
      try {
        const transaction = await this.getTransaction(transactionId);
        if (transaction && transaction.lockId) {
          await this.releaseLock(transaction.schemaId, transaction.lockId);
        }
      } catch (lockError) {
        console.error(
          `[SchemaTransactionService] Error releasing lock for transaction ${transactionId}:`,
          lockError
        );
      }

      return {
        success: false,
        transactionId,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Rollback a transaction
   * @param transactionId Transaction ID
   * @returns Promise<TransactionResult> Transaction result
   */
  async rollbackTransaction(transactionId: string): Promise<TransactionResult> {
    try {
      // Get the transaction
      const transaction = await this.getTransaction(transactionId);

      if (!transaction) {
        return {
          success: false,
          transactionId,
          message: `Transaction ${transactionId} not found`,
        };
      }

      if (transaction.status !== "pending") {
        return {
          success: false,
          transactionId,
          message: `Cannot rollback transaction with status ${transaction.status}`,
        };
      }

      // Update the transaction status
      transaction.status = "rolled_back";
      transaction.completedAt = new Date();

      // Update the transaction in the database
      await executeQuery(`
        UPDATE schema_transactions
        SET 
          status = '${transaction.status}',
          completed_at = CURRENT_TIMESTAMP
        WHERE id = '${transactionId}'
      `);

      // Release the lock
      if (transaction.lockId) {
        await this.releaseLock(transaction.schemaId, transaction.lockId);
      }

      return {
        success: true,
        transactionId,
        message: "Transaction rolled back successfully",
      };
    } catch (error) {
      console.error(
        `[SchemaTransactionService] Error rolling back transaction ${transactionId}:`,
        error
      );

      // Try to release the lock
      try {
        const transaction = await this.getTransaction(transactionId);
        if (transaction && transaction.lockId) {
          await this.releaseLock(transaction.schemaId, transaction.lockId);
        }
      } catch (lockError) {
        console.error(
          `[SchemaTransactionService] Error releasing lock for transaction ${transactionId}:`,
          lockError
        );
      }

      return {
        success: false,
        transactionId,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get a transaction
   * @param transactionId Transaction ID
   * @returns Promise<SchemaTransaction | null> Transaction or null if not found
   */
  async getTransaction(
    transactionId: string
  ): Promise<SchemaTransaction | null> {
    try {
      // Check if the schema_transactions table exists
      const tableExists = await this.checkIfTableExists("schema_transactions");

      if (!tableExists) {
        return null;
      }

      // Get the transaction
      const result = (await executeQuery(`
        SELECT id, schema_id, user_id, status, operations, started_at, completed_at, error_message, lock_id
        FROM schema_transactions
        WHERE id = '${transactionId}'
      `)) as Array<{
        id: string;
        schema_id: string;
        user_id: string;
        status: string;
        operations: string;
        started_at: string;
        completed_at: string;
        error_message: string;
        lock_id: string;
      }>;

      if (!result || result.length === 0) {
        return null;
      }

      const row = result[0];

      // Parse operations
      let parsedOperations = [];
      try {
        if (row.operations) {
          if (typeof row.operations === "string") {
            parsedOperations = JSON.parse(row.operations);
          } else if (typeof row.operations === "object") {
            parsedOperations = row.operations;
          }
        }
      } catch (parseError) {
        console.error(
          `[SchemaTransactionService] Error parsing operations for transaction ${row.id}:`,
          parseError
        );
      }

      return {
        id: row.id,
        schemaId: row.schema_id,
        userId: row.user_id,
        status: row.status as
          | "pending"
          | "committed"
          | "rolled_back"
          | "failed",
        operations: parsedOperations,
        startedAt: new Date(row.started_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
        errorMessage: row.error_message,
        lockId: row.lock_id,
      };
    } catch (error) {
      console.error(
        `[SchemaTransactionService] Error getting transaction ${transactionId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get transactions for a schema
   * @param schemaId Schema ID
   * @returns Promise<SchemaTransaction[]> Transactions
   */
  async getTransactionsForSchema(
    schemaId: string
  ): Promise<SchemaTransaction[]> {
    try {
      // Check if the schema_transactions table exists
      const tableExists = await this.checkIfTableExists("schema_transactions");

      if (!tableExists) {
        return [];
      }

      // Get the transactions
      const result = (await executeQuery(`
        SELECT id, schema_id, user_id, status, operations, started_at, completed_at, error_message, lock_id
        FROM schema_transactions
        WHERE schema_id = '${schemaId}'
        ORDER BY started_at DESC
      `)) as Array<{
        id: string;
        schema_id: string;
        user_id: string;
        status: string;
        operations: string;
        started_at: string;
        completed_at: string;
        error_message: string;
        lock_id: string;
      }>;

      return (result || []).map((row) => {
        // Parse operations
        let parsedOperations = [];
        try {
          if (row.operations) {
            if (typeof row.operations === "string") {
              parsedOperations = JSON.parse(row.operations);
            } else if (typeof row.operations === "object") {
              parsedOperations = row.operations;
            }
          }
        } catch (parseError) {
          console.error(
            `[SchemaTransactionService] Error parsing operations for transaction ${row.id}:`,
            parseError
          );
        }

        return {
          id: row.id,
          schemaId: row.schema_id,
          userId: row.user_id,
          status: row.status as
            | "pending"
            | "committed"
            | "rolled_back"
            | "failed",
          operations: parsedOperations,
          startedAt: new Date(row.started_at),
          completedAt: row.completed_at
            ? new Date(row.completed_at)
            : undefined,
          errorMessage: row.error_message,
          lockId: row.lock_id,
        };
      });
    } catch (error) {
      console.error(
        `[SchemaTransactionService] Error getting transactions for schema ${schemaId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Execute a schema operation
   * @param schemaId Schema ID
   * @param operation Schema operation
   * @returns Promise<void>
   */
  private async executeOperation(
    schemaId: string,
    operation: SchemaOperation
  ): Promise<void> {
    try {
      // Get the schema
      const schema = await this.getSchema(schemaId);

      if (!schema) {
        throw new Error(`Schema ${schemaId} not found`);
      }

      // Execute the operation based on the type
      switch (operation.type) {
        case "add_column":
          await this.executeAddColumn(schema, operation);
          break;
        case "remove_column":
          await this.executeRemoveColumn(schema, operation);
          break;
        case "modify_column":
          await this.executeModifyColumn(schema, operation);
          break;
        case "update_schema":
          await this.executeUpdateSchema(schema, operation);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }
    } catch (error) {
      console.error(
        `[SchemaTransactionService] Error executing operation:`,
        error
      );
      throw error;
    }
  }

  /**
   * Execute add column operation
   * @param schema Schema
   * @param operation Schema operation
   * @returns Promise<void>
   */
  private async executeAddColumn(
    schema: GlobalSchema,
    operation: SchemaOperation
  ): Promise<void> {
    try {
      // Check if the column already exists
      const columnExists = schema.columns.some(
        (col) => col.name === operation.target
      );

      if (columnExists) {
        throw new Error(`Column ${operation.target} already exists`);
      }

      // Add the column
      schema.columns.push(operation.params);

      // Update the schema
      await this.updateSchemaInDatabase(schema);
    } catch (error) {
      console.error(
        `[SchemaTransactionService] Error executing add column operation:`,
        error
      );
      throw error;
    }
  }

  /**
   * Execute remove column operation
   * @param schema Schema
   * @param operation Schema operation
   * @returns Promise<void>
   */
  private async executeRemoveColumn(
    schema: GlobalSchema,
    operation: SchemaOperation
  ): Promise<void> {
    try {
      // Check if the column exists
      const columnIndex = schema.columns.findIndex(
        (col) => col.name === operation.target
      );

      if (columnIndex === -1) {
        throw new Error(`Column ${operation.target} not found`);
      }

      // Remove the column
      schema.columns.splice(columnIndex, 1);

      // Update the schema
      await this.updateSchemaInDatabase(schema);
    } catch (error) {
      console.error(
        `[SchemaTransactionService] Error executing remove column operation:`,
        error
      );
      throw error;
    }
  }

  /**
   * Execute modify column operation
   * @param schema Schema
   * @param operation Schema operation
   * @returns Promise<void>
   */
  private async executeModifyColumn(
    schema: GlobalSchema,
    operation: SchemaOperation
  ): Promise<void> {
    try {
      // Check if the column exists
      const columnIndex = schema.columns.findIndex(
        (col) => col.name === operation.target
      );

      if (columnIndex === -1) {
        throw new Error(`Column ${operation.target} not found`);
      }

      // Modify the column
      schema.columns[columnIndex] = {
        ...schema.columns[columnIndex],
        ...operation.params,
      };

      // Update the schema
      await this.updateSchemaInDatabase(schema);
    } catch (error) {
      console.error(
        `[SchemaTransactionService] Error executing modify column operation:`,
        error
      );
      throw error;
    }
  }

  /**
   * Execute update schema operation
   * @param schema Schema
   * @param operation Schema operation
   * @returns Promise<void>
   */
  private async executeUpdateSchema(
    schema: GlobalSchema,
    operation: SchemaOperation
  ): Promise<void> {
    try {
      // Update the schema
      const updatedSchema = {
        ...schema,
        ...operation.params,
      };

      // Update the schema
      await this.updateSchemaInDatabase(updatedSchema);
    } catch (error) {
      console.error(
        `[SchemaTransactionService] Error executing update schema operation:`,
        error
      );
      throw error;
    }
  }

  /**
   * Update schema in database
   * @param schema Schema
   * @returns Promise<void>
   */
  private async updateSchemaInDatabase(schema: GlobalSchema): Promise<void> {
    try {
      // Update the schema
      await executeQuery(`
        UPDATE global_schemas
        SET 
          name = '${schema.name}',
          description = ${
            schema.description ? `'${schema.description}'` : "NULL"
          },
          columns = '${JSON.stringify(schema.columns)}',
          updated_at = CURRENT_TIMESTAMP,
          version = ${schema.version + 1}
        WHERE id = '${schema.id}'
      `);
    } catch (error) {
      console.error(
        `[SchemaTransactionService] Error updating schema in database:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get a schema
   * @param schemaId Schema ID
   * @returns Promise<GlobalSchema | null> Schema or null if not found
   */
  private async getSchema(schemaId: string): Promise<GlobalSchema | null> {
    try {
      // Get the schema
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
        return null;
      }

      const row = result[0];

      // Parse columns
      let parsedColumns = [];
      try {
        if (row.columns) {
          if (typeof row.columns === "string") {
            parsedColumns = JSON.parse(row.columns);
          } else if (typeof row.columns === "object") {
            parsedColumns = row.columns;
          }
        }
      } catch (parseError) {
        console.error(
          `[SchemaTransactionService] Error parsing columns for schema ${row.id}:`,
          parseError
        );
      }

      return {
        id: row.id,
        userId: row.user_id,
        projectId: row.project_id,
        name: row.name,
        description: row.description,
        columns: parsedColumns,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        isActive: row.is_active,
        version: row.version,
        previousVersionId: row.previous_version_id,
      };
    } catch (error) {
      console.error(
        `[SchemaTransactionService] Error getting schema ${schemaId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Acquire a lock on a schema
   * @param schemaId Schema ID
   * @param lockId Lock ID
   * @param options Transaction options
   * @returns Promise<boolean> True if lock acquired
   */
  private async acquireLock(
    schemaId: string,
    lockId: string,
    options?: TransactionOptions
  ): Promise<boolean> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    let retries = 0;

    // Check if the schema_locks table exists
    const tableExists = await this.checkIfTableExists("schema_locks");

    if (!tableExists) {
      // Create the table if it doesn't exist
      await executeQuery(`
        CREATE TABLE schema_locks (
          schema_id TEXT PRIMARY KEY,
          lock_id TEXT NOT NULL,
          acquired_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL
        )
      `);
    }

    const retryCount = opts.retryCount ?? this.defaultOptions.retryCount ?? 3;
    const retryDelay =
      opts.retryDelay ?? this.defaultOptions.retryDelay ?? 1000;
    const timeout = opts.timeout ?? this.defaultOptions.timeout ?? 30000;

    while (retries < retryCount) {
      try {
        // Check if the schema is already locked
        const result = (await executeQuery(`
          SELECT lock_id, expires_at
          FROM schema_locks
          WHERE schema_id = '${schemaId}'
        `)) as Array<{
          lock_id: string;
          expires_at: string;
        }>;

        if (result && result.length > 0) {
          const row = result[0];
          const expiresAt = new Date(row.expires_at);

          // Check if the lock has expired
          if (expiresAt > new Date()) {
            // Lock is still valid, wait and retry
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            retries++;
            continue;
          }

          // Lock has expired, remove it
          await executeQuery(`
            DELETE FROM schema_locks
            WHERE schema_id = '${schemaId}'
          `);
        }

        // Try to acquire the lock
        const expiresAt = new Date(Date.now() + timeout);
        await executeQuery(`
          INSERT INTO schema_locks (schema_id, lock_id, acquired_at, expires_at)
          VALUES (
            '${schemaId}',
            '${lockId}',
            CURRENT_TIMESTAMP,
            '${expiresAt.toISOString()}'
          )
          ON CONFLICT (schema_id)
          DO NOTHING
        `);

        // Check if we acquired the lock
        const lockResult = (await executeQuery(`
          SELECT lock_id
          FROM schema_locks
          WHERE schema_id = '${schemaId}' AND lock_id = '${lockId}'
        `)) as Array<{
          lock_id: string;
        }>;

        if (lockResult && lockResult.length > 0) {
          return true;
        }

        // Lock not acquired, wait and retry
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retries++;
      } catch (error) {
        console.error(
          `[SchemaTransactionService] Error acquiring lock for schema ${schemaId}:`,
          error
        );
        retries++;
      }

      // Check if we've timed out
      if (Date.now() - startTime > timeout) {
        break;
      }
    }

    return false;
  }

  /**
   * Release a lock on a schema
   * @param schemaId Schema ID
   * @param lockId Lock ID
   * @returns Promise<boolean> True if lock released
   */
  private async releaseLock(
    schemaId: string,
    lockId: string
  ): Promise<boolean> {
    try {
      // Check if the schema_locks table exists
      const tableExists = await this.checkIfTableExists("schema_locks");

      if (!tableExists) {
        return false;
      }

      // Release the lock
      await executeQuery(`
        DELETE FROM schema_locks
        WHERE schema_id = '${schemaId}' AND lock_id = '${lockId}'
      `);

      return true;
    } catch (error) {
      console.error(
        `[SchemaTransactionService] Error releasing lock for schema ${schemaId}:`,
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
      const result = (await executeQuery(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = '${tableName}'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      return result && result.length > 0 && result[0].exists;
    } catch (error) {
      console.error(
        `[SchemaTransactionService] Error checking if table ${tableName} exists:`,
        error
      );
      return false;
    }
  }
}

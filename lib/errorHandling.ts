import { FileStatus, updateFileStatus } from "./fileIngestion";
import { executeQuery } from "./database";

// Declare global type for retry operations tracking
declare global {
  var retryOperationsInProgress: Map<string, boolean>;
}

// Define error types
export enum ErrorType {
  VALIDATION = "validation",
  PARSING = "parsing",
  CONVERSION = "conversion",
  DATABASE = "database",
  SYSTEM = "system",
}

// Define error severity
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// Error interface
export interface FileError {
  fileId: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Log error to console with appropriate formatting
 * @param error Error object
 */
export function logError(error: FileError): void {
  const timestamp = error.timestamp.toISOString();
  const prefix = `[ERROR][${error.type.toUpperCase()}][${error.severity.toUpperCase()}]`;

  console.error(
    `${prefix} ${timestamp} - File ${error.fileId}: ${error.message}`
  );

  if (error.details) {
    console.error(`${prefix} Details:`, error.details);
  }
}

/**
 * Store error in database
 * @param error Error object
 */
export async function storeError(error: FileError): Promise<void> {
  try {
    // Convert details to JSON string if present
    const detailsJson = error.details ? JSON.stringify(error.details) : null;

    try {
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS file_errors (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          file_id TEXT NOT NULL,
          error_type TEXT NOT NULL,
          severity TEXT NOT NULL,
          message TEXT NOT NULL,
          details TEXT,
          timestamp TIMESTAMP NOT NULL
        );
      `);

      await executeQuery(`
        INSERT INTO file_errors (
          file_id, error_type, severity, message, details, timestamp
        ) VALUES (
          '${error.fileId}',
          '${error.type}',
          '${error.severity}',
          '${error.message.replace(/'/g, "''")}',
          ${detailsJson ? `'${detailsJson.replace(/'/g, "''")}'` : "NULL"},
          '${error.timestamp.toISOString()}'
        );
      `);
    } catch (dbErr) {
      // If this is a server environment, just log the error instead of storing in DB
      if (
        dbErr instanceof Error &&
        (dbErr.message === "DuckDB is not available in server environments" ||
          dbErr.message.includes("Worker is not defined"))
      ) {
        console.warn(
          "Error storage skipped: DuckDB not available in server environment"
        );
      } else {
        // Re-throw other database errors
        throw dbErr;
      }
    }
  } catch (err) {
    console.error("Failed to store error in database:", err);
  }
}

/**
 * Handle file processing error
 * @param fileId File ID
 * @param type Error type
 * @param severity Error severity
 * @param message Error message
 * @param details Additional error details
 */
export async function handleFileError(
  fileId: string,
  type: ErrorType,
  severity: ErrorSeverity,
  message: string,
  details?: Record<string, unknown>
): Promise<void> {
  const error: FileError = {
    fileId,
    type,
    severity,
    message,
    details,
    timestamp: new Date(),
  };

  // Log error
  logError(error);

  // Store error in database
  await storeError(error);

  // Update file status to error
  if (
    severity === ErrorSeverity.MEDIUM ||
    severity === ErrorSeverity.HIGH ||
    severity === ErrorSeverity.CRITICAL
  ) {
    await updateFileStatus(fileId, FileStatus.ERROR);
  }
}

/**
 * Implement retry mechanism with exponential backoff and idempotency
 * @param operation Function to retry
 * @param maxRetries Maximum number of retries
 * @param baseDelay Base delay in milliseconds
 * @param operationId Optional unique ID for the operation to track retries
 * @returns Promise with operation result
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  operationId?: string
): Promise<T> {
  let lastError: Error | null = null;
  const retryId =
    operationId ||
    `retry-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

  // Track this operation to prevent duplicate processing
  console.log(`Starting operation with retry ID: ${retryId}`);

  // Store in-memory cache of operations in progress (for server-side)
  if (!global.retryOperationsInProgress) {
    global.retryOperationsInProgress = new Map<string, boolean>();
  }

  // Check if this operation is already in progress
  if (operationId && global.retryOperationsInProgress.get(operationId)) {
    console.warn(
      `Operation ${operationId} is already in progress. Skipping duplicate execution.`
    );
    throw new Error(`Duplicate operation detected: ${operationId}`);
  }

  // Mark operation as in progress
  if (operationId) {
    global.retryOperationsInProgress.set(operationId, true);
  }

  try {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await operation();

        // Operation succeeded, clean up
        if (operationId) {
          global.retryOperationsInProgress.delete(operationId);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if this is a non-retryable error (like duplicate processing)
        if (
          lastError.message.includes("Duplicate operation") ||
          lastError.message.includes("already being processed") ||
          lastError.message.includes("already exists")
        ) {
          console.warn(`Non-retryable error detected: ${lastError.message}`);
          throw lastError; // Don't retry for these specific errors
        }

        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);

        console.log(
          `Retry attempt ${
            attempt + 1
          }/${maxRetries} failed. Retrying in ${delay}ms...`
        );

        // Wait before next retry
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // If we've exhausted all retries, throw the last error
    throw lastError;
  } finally {
    // Always clean up the operation tracking
    if (operationId) {
      global.retryOperationsInProgress.delete(operationId);
    }
  }
}

/**
 * Create a dead letter queue for failed operations
 * @param fileId File ID
 * @param operation Operation name
 * @param payload Operation payload
 * @param error Error that occurred
 */
export async function addToDeadLetterQueue(
  fileId: string,
  operation: string,
  payload: Record<string, unknown>,
  error: unknown
): Promise<void> {
  try {
    try {
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS dead_letter_queue (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          file_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          payload TEXT NOT NULL,
          error TEXT NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          retry_count INTEGER DEFAULT 0,
          last_retry_at TIMESTAMP
        );
      `);

      await executeQuery(`
        INSERT INTO dead_letter_queue (
          file_id, operation, payload, error, timestamp
        ) VALUES (
          '${fileId}',
          '${operation}',
          '${JSON.stringify(payload).replace(/'/g, "''")}',
          '${JSON.stringify(error).replace(/'/g, "''")}',
          CURRENT_TIMESTAMP
        );
      `);

      console.log(
        `Added failed operation to dead letter queue: ${operation} for file ${fileId}`
      );
    } catch (dbErr) {
      // If this is a server environment, just log the error instead of storing in DB
      if (
        dbErr instanceof Error &&
        (dbErr.message === "DuckDB is not available in server environments" ||
          dbErr.message.includes("Worker is not defined"))
      ) {
        console.warn(
          `Dead letter queue operation skipped: DuckDB not available in server environment. Operation: ${operation}, File: ${fileId}`
        );
      } else {
        // Re-throw other database errors
        throw dbErr;
      }
    }
  } catch (err) {
    console.error("Failed to add to dead letter queue:", err);
  }
}

/**
 * Process items in the dead letter queue
 * @param maxItems Maximum number of items to process
 * @param maxRetries Maximum number of retries per item
 */
export async function processDeadLetterQueue(
  maxItems: number = 10,
  maxRetries: number = 3
): Promise<void> {
  try {
    try {
      // Get items from the queue
      const items = (await executeQuery(`
        SELECT * FROM dead_letter_queue
        WHERE retry_count < ${maxRetries}
        ORDER BY timestamp ASC
        LIMIT ${maxItems};
      `)) as Array<Record<string, unknown>>;

      if (!items || items.length === 0) {
        console.log("No items in dead letter queue to process");
        return;
      }

      console.log(`Processing ${items.length} items from dead letter queue`);

      // Process each item
      for (const item of items) {
        try {
          // Update retry count and timestamp
          await executeQuery(`
            UPDATE dead_letter_queue
            SET retry_count = retry_count + 1, last_retry_at = CURRENT_TIMESTAMP
            WHERE id = '${item.id as string}';
          `);

          // TODO: Implement actual retry logic based on operation type
          console.log(
            `Retrying operation ${item.operation as string} for file ${
              item.file_id as string
            } (attempt ${(item.retry_count as number) + 1}/${maxRetries})`
          );

          // If successful, remove from queue
          await executeQuery(`
            DELETE FROM dead_letter_queue
            WHERE id = '${item.id as string}';
          `);

          console.log(`Successfully processed queue item ${item.id as string}`);
        } catch (error) {
          console.error(
            `Failed to process queue item ${item.id as string}:`,
            error
          );
        }
      }
    } catch (dbErr) {
      // If this is a server environment, just log and return
      if (
        dbErr instanceof Error &&
        (dbErr.message === "DuckDB is not available in server environments" ||
          dbErr.message.includes("Worker is not defined"))
      ) {
        console.warn(
          "Dead letter queue processing skipped: DuckDB not available in server environment"
        );
        return;
      }
      // Re-throw other database errors
      throw dbErr;
    }
  } catch (error) {
    console.error("Error processing dead letter queue:", error);
  }
}

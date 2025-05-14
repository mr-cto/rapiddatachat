import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

/**
 * Error types
 */
export enum ErrorType {
  VALIDATION_ERROR = "validation_error",
  TRANSFORMATION_ERROR = "transformation_error",
  STORAGE_ERROR = "storage_error",
  SYSTEM_ERROR = "system_error",
  NETWORK_ERROR = "network_error",
  AUTHENTICATION_ERROR = "authentication_error",
  AUTHORIZATION_ERROR = "authorization_error",
  NOT_FOUND_ERROR = "not_found_error",
  TIMEOUT_ERROR = "timeout_error",
  CONCURRENCY_ERROR = "concurrency_error",
  RESOURCE_ERROR = "resource_error",
  CONFIGURATION_ERROR = "configuration_error",
  INTEGRATION_ERROR = "integration_error",
  BUSINESS_RULE_ERROR = "business_rule_error",
  DATA_QUALITY_ERROR = "data_quality_error",
  UNKNOWN_ERROR = "unknown_error",
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  DEBUG = "debug",
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

/**
 * Error input
 */
export interface ErrorInput {
  type: ErrorType;
  message: string;
  context?: any;
  stack?: string;
  requestId?: string;
  userId?: string;
  systemState?: any;
  projectId?: string;
  severity?: ErrorSeverity;
}

/**
 * Retry policy
 */
export interface RetryPolicy {
  maxRetries: number;
  retryDelay: number;
  backoffFactor: number;
  retryableErrors?: ErrorType[];
}

/**
 * Dead letter queue item input
 */
export interface DeadLetterQueueItemInput {
  operationType: string;
  operationData: any;
  errorType: ErrorType;
  errorMessage: string;
  maxRetries: number;
  projectId?: string;
  fileId?: string;
}

/**
 * System health status
 */
export enum SystemHealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
}

/**
 * System health input
 */
export interface SystemHealthInput {
  component: string;
  status: SystemHealthStatus;
  lastError?: string;
  metrics?: any;
}

/**
 * Error handling service
 */
export class ErrorHandlingService {
  private prisma: PrismaClient;
  private defaultRetryPolicy: RetryPolicy = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffFactor: 2,
    retryableErrors: [
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.CONCURRENCY_ERROR,
    ],
  };

  /**
   * Constructor
   */
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Log error
   * @param input Error input
   * @returns Promise<string> Error log ID
   */
  async logError(input: ErrorInput): Promise<string> {
    try {
      // Generate ID
      const id = `error_${uuidv4()}`;

      // Create error log
      await this.prisma.errorLog.create({
        data: {
          id,
          errorType: input.type,
          errorMessage: input.message,
          errorContext: input.context
            ? JSON.stringify(input.context)
            : undefined,
          errorStack: input.stack,
          requestId: input.requestId,
          userId: input.userId,
          systemState: input.systemState
            ? JSON.stringify(input.systemState)
            : undefined,
          projectId: input.projectId,
        },
      });

      // Log to console based on severity
      const severity = input.severity || ErrorSeverity.ERROR;
      switch (severity) {
        case ErrorSeverity.DEBUG:
          console.debug(`[${input.type}] ${input.message}`);
          break;
        case ErrorSeverity.INFO:
          console.info(`[${input.type}] ${input.message}`);
          break;
        case ErrorSeverity.WARNING:
          console.warn(`[${input.type}] ${input.message}`);
          break;
        case ErrorSeverity.ERROR:
          console.error(`[${input.type}] ${input.message}`);
          break;
        case ErrorSeverity.CRITICAL:
          console.error(`[CRITICAL] [${input.type}] ${input.message}`);
          break;
      }

      return id;
    } catch (error) {
      console.error("Error logging error:", error);
      throw error;
    }
  }

  /**
   * Get error logs
   * @param projectId Optional project ID
   * @param errorType Optional error type
   * @param startDate Optional start date
   * @param endDate Optional end date
   * @param limit Optional limit
   * @param offset Optional offset
   * @returns Promise<any[]> Error logs
   */
  async getErrorLogs(
    projectId?: string,
    errorType?: ErrorType,
    startDate?: Date,
    endDate?: Date,
    limit?: number,
    offset?: number
  ): Promise<any[]> {
    try {
      // Build filter
      const filter: any = {};

      if (projectId) {
        filter.projectId = projectId;
      }

      if (errorType) {
        filter.errorType = errorType;
      }

      if (startDate || endDate) {
        filter.createdAt = {};

        if (startDate) {
          filter.createdAt.gte = startDate;
        }

        if (endDate) {
          filter.createdAt.lte = endDate;
        }
      }

      // Get error logs
      const errorLogs = await this.prisma.errorLog.findMany({
        where: filter,
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
      });

      return errorLogs;
    } catch (error) {
      console.error("Error getting error logs:", error);
      throw error;
    }
  }

  /**
   * Add to dead letter queue
   * @param input Dead letter queue item input
   * @returns Promise<string> Dead letter queue item ID
   */
  async addToDeadLetterQueue(input: DeadLetterQueueItemInput): Promise<string> {
    try {
      // Generate ID
      const id = `dlq_${uuidv4()}`;

      // Calculate next retry time
      const nextRetryAt = new Date();
      nextRetryAt.setMilliseconds(
        nextRetryAt.getMilliseconds() + this.defaultRetryPolicy.retryDelay
      );

      // Create dead letter queue item
      await this.prisma.deadLetterQueueItem.create({
        data: {
          id,
          operation: input.operationType,
          payload: JSON.stringify(input.operationData),
          error: input.errorMessage,
          retryCount: 0,
          timestamp: new Date(),
          projectId: input.projectId || undefined,
          fileId: input.fileId || "unknown", // fileId is required
        },
      });

      // Log error
      await this.logError({
        type: input.errorType,
        message: `Operation ${input.operationType} added to dead letter queue: ${input.errorMessage}`,
        context: {
          operationType: input.operationType,
          operationData: input.operationData,
          deadLetterQueueItemId: id,
        },
        projectId: input.projectId,
        severity: ErrorSeverity.WARNING,
      });

      return id;
    } catch (error) {
      console.error("Error adding to dead letter queue:", error);
      throw error;
    }
  }

  /**
   * Get dead letter queue items
   * @param projectId Optional project ID
   * @param operationType Optional operation type
   * @param errorType Optional error type
   * @param limit Optional limit
   * @param offset Optional offset
   * @returns Promise<any[]> Dead letter queue items
   */
  async getDeadLetterQueueItems(
    projectId?: string,
    operationType?: string,
    errorType?: ErrorType,
    limit?: number,
    offset?: number
  ): Promise<any[]> {
    try {
      // Build filter
      const filter: any = {};

      if (projectId) {
        filter.projectId = projectId;
      }

      if (operationType) {
        filter.operationType = operationType;
      }

      if (errorType) {
        filter.errorType = errorType;
      }

      // Get dead letter queue items
      const deadLetterQueueItems =
        await this.prisma.deadLetterQueueItem.findMany({
          where: filter,
          orderBy: {
            timestamp: "desc",
          },
          take: limit,
          skip: offset,
        });

      return deadLetterQueueItems;
    } catch (error) {
      console.error("Error getting dead letter queue items:", error);
      throw error;
    }
  }

  /**
   * Process dead letter queue
   * @param limit Optional limit
   * @returns Promise<number> Number of processed items
   */
  async processDeadLetterQueue(limit?: number): Promise<number> {
    try {
      // Get items ready for retry
      const items = await this.prisma.deadLetterQueueItem.findMany({
        where: {
          lastRetryAt: {
            lte: new Date(),
          },
          retryCount: {
            lt: 3, // Default max retries
          },
        },
        orderBy: {
          timestamp: "asc",
        },
        take: limit,
      });

      let processedCount = 0;

      // Process each item
      for (const item of items) {
        try {
          // Increment retry count
          const retryCount = item.retryCount + 1;

          // Calculate next retry time with exponential backoff
          const nextRetryAt = new Date();
          const delay =
            this.defaultRetryPolicy.retryDelay *
            Math.pow(this.defaultRetryPolicy.backoffFactor, retryCount);
          nextRetryAt.setMilliseconds(nextRetryAt.getMilliseconds() + delay);

          // Update item
          await this.prisma.deadLetterQueueItem.update({
            where: {
              id: item.id,
            },
            data: {
              retryCount,
              lastRetryAt: new Date(),
            },
          });

          // TODO: Implement actual retry logic based on operation type
          // This would involve calling the appropriate service to retry the operation
          // For now, we just log the retry attempt

          await this.logError({
            type: ErrorType.SYSTEM_ERROR,
            message: `Retry ${retryCount}/3 for operation ${item.operation}`,
            context: {
              operation: item.operation,
              payload: JSON.parse(item.payload),
              deadLetterQueueItemId: item.id,
            },
            projectId: item.projectId || undefined,
            severity: ErrorSeverity.INFO,
          });

          processedCount++;
        } catch (error) {
          console.error(
            `Error processing dead letter queue item ${item.id}:`,
            error
          );

          // Log error
          await this.logError({
            type: ErrorType.SYSTEM_ERROR,
            message: `Error processing dead letter queue item ${item.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
            context: {
              deadLetterQueueItemId: item.id,
              error,
            },
            projectId: item.projectId || undefined,
            severity: ErrorSeverity.ERROR,
          });
        }
      }

      return processedCount;
    } catch (error) {
      console.error("Error processing dead letter queue:", error);
      throw error;
    }
  }

  /**
   * Retry dead letter queue item
   * @param id Dead letter queue item ID
   * @returns Promise<boolean> Success
   */
  async retryDeadLetterQueueItem(id: string): Promise<boolean> {
    try {
      // Get item
      const item = await this.prisma.deadLetterQueueItem.findUnique({
        where: {
          id,
        },
      });

      if (!item) {
        throw new Error(`Dead letter queue item ${id} not found`);
      }

      // Increment retry count
      const retryCount = item.retryCount + 1;

      // Calculate next retry time with exponential backoff
      const nextRetryAt = new Date();
      const delay =
        this.defaultRetryPolicy.retryDelay *
        Math.pow(this.defaultRetryPolicy.backoffFactor, retryCount);
      nextRetryAt.setMilliseconds(nextRetryAt.getMilliseconds() + delay);

      // Update item
      await this.prisma.deadLetterQueueItem.update({
        where: {
          id,
        },
        data: {
          retryCount,
          lastRetryAt: new Date(),
        },
      });

      // TODO: Implement actual retry logic based on operation type
      // This would involve calling the appropriate service to retry the operation
      // For now, we just log the retry attempt

      await this.logError({
        type: ErrorType.SYSTEM_ERROR,
        message: `Manual retry ${retryCount}/3 for operation ${item.operation}`,
        context: {
          operation: item.operation,
          payload: JSON.parse(item.payload),
          deadLetterQueueItemId: item.id,
        },
        projectId: item.projectId || undefined,
        severity: ErrorSeverity.INFO,
      });

      return true;
    } catch (error) {
      console.error(`Error retrying dead letter queue item ${id}:`, error);

      // Log error
      await this.logError({
        type: ErrorType.SYSTEM_ERROR,
        message: `Error retrying dead letter queue item ${id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        context: {
          deadLetterQueueItemId: id,
          error,
        },
        severity: ErrorSeverity.ERROR,
      });

      return false;
    }
  }

  /**
   * Delete dead letter queue item
   * @param id Dead letter queue item ID
   * @returns Promise<boolean> Success
   */
  async deleteDeadLetterQueueItem(id: string): Promise<boolean> {
    try {
      // Delete item
      await this.prisma.deadLetterQueueItem.delete({
        where: {
          id,
        },
      });

      return true;
    } catch (error) {
      console.error(`Error deleting dead letter queue item ${id}:`, error);

      // Log error
      await this.logError({
        type: ErrorType.SYSTEM_ERROR,
        message: `Error deleting dead letter queue item ${id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        context: {
          deadLetterQueueItemId: id,
          error,
        },
        severity: ErrorSeverity.ERROR,
      });

      return false;
    }
  }

  /**
   * Update system health
   * @param input System health input
   * @returns Promise<string> System health ID
   */
  async updateSystemHealth(input: SystemHealthInput): Promise<string> {
    try {
      // Generate ID
      const id = `health_${input.component}`;

      // Check if health record exists
      const existingHealth = await this.prisma.systemHealth.findUnique({
        where: {
          id,
        },
      });

      if (existingHealth) {
        // Update health record
        await this.prisma.systemHealth.update({
          where: {
            id,
          },
          data: {
            status: input.status,
            lastCheckAt: new Date(),
            lastError: input.lastError,
            metrics: input.metrics ? JSON.stringify(input.metrics) : undefined,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create health record
        await this.prisma.systemHealth.create({
          data: {
            id,
            component: input.component,
            status: input.status,
            lastCheckAt: new Date(),
            lastError: input.lastError,
            metrics: input.metrics ? JSON.stringify(input.metrics) : undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      // Log health update if status is not healthy
      if (input.status !== SystemHealthStatus.HEALTHY) {
        await this.logError({
          type: ErrorType.SYSTEM_ERROR,
          message: `System component ${input.component} is ${input.status}${
            input.lastError ? `: ${input.lastError}` : ""
          }`,
          context: {
            component: input.component,
            status: input.status,
            metrics: input.metrics,
          },
          severity:
            input.status === SystemHealthStatus.DEGRADED
              ? ErrorSeverity.WARNING
              : ErrorSeverity.ERROR,
        });
      }

      return id;
    } catch (error) {
      console.error("Error updating system health:", error);
      throw error;
    }
  }

  /**
   * Get system health
   * @param component Optional component
   * @returns Promise<any[]> System health records
   */
  async getSystemHealth(component?: string): Promise<any[]> {
    try {
      // Build filter
      const filter: any = {};

      if (component) {
        filter.component = component;
      }

      // Get health records
      const healthRecords = await this.prisma.systemHealth.findMany({
        where: filter,
        orderBy: {
          component: "asc",
        },
      });

      return healthRecords;
    } catch (error) {
      console.error("Error getting system health:", error);
      throw error;
    }
  }

  /**
   * Execute with retry
   * @param operation Operation to execute
   * @param retryPolicy Optional retry policy
   * @returns Promise<any> Operation result
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryPolicy?: RetryPolicy
  ): Promise<T> {
    // Use provided retry policy or default
    const policy = retryPolicy || this.defaultRetryPolicy;

    let lastError: any;

    // Try operation with retries
    for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
      try {
        // Execute operation
        return await operation();
      } catch (error) {
        lastError = error;

        // Check if we've reached max retries
        if (attempt >= policy.maxRetries) {
          break;
        }

        // Check if error is retryable
        const errorType = this.getErrorType(error);
        if (
          policy.retryableErrors &&
          !policy.retryableErrors.includes(errorType)
        ) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay =
          policy.retryDelay * Math.pow(policy.backoffFactor, attempt);

        // Log retry attempt
        console.warn(
          `Retry ${attempt + 1}/${
            policy.maxRetries
          } after ${delay}ms for error: ${
            error instanceof Error ? error.message : String(error)
          }`
        );

        // Wait before next retry
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // If we get here, all retries failed
    throw lastError;
  }

  /**
   * Get error type from error
   * @param error Error
   * @returns ErrorType
   */
  private getErrorType(error: any): ErrorType {
    if (!error) {
      return ErrorType.UNKNOWN_ERROR;
    }

    // Check if error has a type property
    if (error.type && Object.values(ErrorType).includes(error.type)) {
      return error.type;
    }

    // Check error name
    if (error.name) {
      switch (error.name) {
        case "ValidationError":
          return ErrorType.VALIDATION_ERROR;
        case "TransformationError":
          return ErrorType.TRANSFORMATION_ERROR;
        case "StorageError":
          return ErrorType.STORAGE_ERROR;
        case "NetworkError":
        case "FetchError":
          return ErrorType.NETWORK_ERROR;
        case "AuthenticationError":
          return ErrorType.AUTHENTICATION_ERROR;
        case "AuthorizationError":
          return ErrorType.AUTHORIZATION_ERROR;
        case "NotFoundError":
          return ErrorType.NOT_FOUND_ERROR;
        case "TimeoutError":
          return ErrorType.TIMEOUT_ERROR;
        case "ConcurrencyError":
          return ErrorType.CONCURRENCY_ERROR;
        case "ResourceError":
          return ErrorType.RESOURCE_ERROR;
        case "ConfigurationError":
          return ErrorType.CONFIGURATION_ERROR;
        case "IntegrationError":
          return ErrorType.INTEGRATION_ERROR;
        case "BusinessRuleError":
          return ErrorType.BUSINESS_RULE_ERROR;
        case "DataQualityError":
          return ErrorType.DATA_QUALITY_ERROR;
      }
    }

    // Check error message
    const message = error.message || String(error);
    if (message.includes("validation")) {
      return ErrorType.VALIDATION_ERROR;
    } else if (message.includes("transform")) {
      return ErrorType.TRANSFORMATION_ERROR;
    } else if (
      message.includes("storage") ||
      message.includes("database") ||
      message.includes("query")
    ) {
      return ErrorType.STORAGE_ERROR;
    } else if (
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("fetch")
    ) {
      return ErrorType.NETWORK_ERROR;
    } else if (
      message.includes("authentication") ||
      message.includes("login") ||
      message.includes("password")
    ) {
      return ErrorType.AUTHENTICATION_ERROR;
    } else if (
      message.includes("authorization") ||
      message.includes("permission") ||
      message.includes("access")
    ) {
      return ErrorType.AUTHORIZATION_ERROR;
    } else if (message.includes("not found") || message.includes("404")) {
      return ErrorType.NOT_FOUND_ERROR;
    } else if (message.includes("timeout") || message.includes("timed out")) {
      return ErrorType.TIMEOUT_ERROR;
    } else if (
      message.includes("concurrency") ||
      message.includes("conflict") ||
      message.includes("race condition")
    ) {
      return ErrorType.CONCURRENCY_ERROR;
    } else if (
      message.includes("resource") ||
      message.includes("memory") ||
      message.includes("cpu")
    ) {
      return ErrorType.RESOURCE_ERROR;
    } else if (
      message.includes("configuration") ||
      message.includes("config")
    ) {
      return ErrorType.CONFIGURATION_ERROR;
    } else if (
      message.includes("integration") ||
      message.includes("external")
    ) {
      return ErrorType.INTEGRATION_ERROR;
    } else if (
      message.includes("business rule") ||
      message.includes("rule violation")
    ) {
      return ErrorType.BUSINESS_RULE_ERROR;
    } else if (
      message.includes("data quality") ||
      message.includes("quality check")
    ) {
      return ErrorType.DATA_QUALITY_ERROR;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * Create transaction manager
   * @returns TransactionManager
   */
  createTransactionManager(): TransactionManager {
    return new TransactionManager(this.prisma);
  }
}

/**
 * Transaction manager
 */
export class TransactionManager {
  private prisma: PrismaClient;
  private transaction: any;

  /**
   * Constructor
   * @param prisma Prisma client
   */
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Begin transaction
   * @returns Promise<void>
   */
  async beginTransaction(): Promise<void> {
    if (this.transaction) {
      throw new Error("Transaction already started");
    }

    this.transaction = await this.prisma.$transaction(
      async (tx) => {
        return tx;
      },
      {
        maxWait: 5000, // 5s
        timeout: 10000, // 10s
      }
    );
  }

  /**
   * Commit transaction
   * @returns Promise<void>
   */
  async commitTransaction(): Promise<void> {
    if (!this.transaction) {
      throw new Error("No transaction started");
    }

    await this.transaction.$commit();
    this.transaction = null;
  }

  /**
   * Rollback transaction
   * @returns Promise<void>
   */
  async rollbackTransaction(): Promise<void> {
    if (!this.transaction) {
      throw new Error("No transaction started");
    }

    await this.transaction.$rollback();
    this.transaction = null;
  }

  /**
   * Get transaction
   * @returns Transaction
   */
  getTransaction(): any {
    if (!this.transaction) {
      throw new Error("No transaction started");
    }

    return this.transaction;
  }
}

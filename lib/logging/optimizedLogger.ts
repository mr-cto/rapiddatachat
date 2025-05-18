import winston from "winston";
import { format } from "winston";
import { getCacheManager } from "../cache/cacheManager";

/**
 * Optimized logging service with caching and batching
 */
export class OptimizedLogger {
  private static instance: OptimizedLogger;
  private logger: winston.Logger;
  private logQueue: any[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 5000; // 5 seconds
  private readonly MAX_QUEUE_SIZE = 100;

  // Log levels
  public static readonly LEVELS = {
    ERROR: "error",
    WARN: "warn",
    INFO: "info",
    DEBUG: "debug",
  };

  // Log categories
  public static readonly CATEGORIES = {
    DATABASE: "DATABASE",
    API: "API",
    SCHEMA: "SCHEMA",
    FILE: "FILE",
    AUTH: "AUTH",
    SYSTEM: "SYSTEM",
  };

  // Log severities
  public static readonly SEVERITIES = {
    HIGH: "HIGH",
    MEDIUM: "MEDIUM",
    LOW: "LOW",
  };

  private constructor() {
    // Create Winston logger with custom format
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: format.combine(format.timestamp(), format.json()),
      defaultMeta: { service: "rapiddatachat" },
      transports: [
        // Console transport for development
        new winston.transports.Console({
          format: format.combine(
            format.colorize(),
            format.printf(({ timestamp, level, message, ...meta }) => {
              return `[${timestamp}] ${level}: ${message} ${
                Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""
              }`;
            })
          ),
        }),
        // File transport for production
        new winston.transports.File({
          filename: "logs/error.log",
          level: "error",
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: "logs/combined.log",
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        }),
      ],
    });

    // Start the flush interval
    this.startFlushInterval();

    console.log("[OptimizedLogger] Initialized");
  }

  /**
   * Get the singleton instance of the logger
   * @returns OptimizedLogger instance
   */
  public static getInstance(): OptimizedLogger {
    if (!OptimizedLogger.instance) {
      OptimizedLogger.instance = new OptimizedLogger();
    }
    return OptimizedLogger.instance;
  }

  /**
   * Start the flush interval
   */
  private startFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Flush the log queue
   */
  private flush(): void {
    if (this.logQueue.length === 0) {
      return;
    }

    const queueToFlush = [...this.logQueue];
    this.logQueue = [];

    // Group logs by level for batch processing
    const logsByLevel: Record<string, any[]> = {};

    queueToFlush.forEach((log) => {
      if (!logsByLevel[log.level]) {
        logsByLevel[log.level] = [];
      }
      logsByLevel[log.level].push(log);
    });

    // Log each batch
    Object.entries(logsByLevel).forEach(([level, logs]) => {
      if (logs.length === 1) {
        // Single log
        const log = logs[0];
        this.logger.log(level, log.message, log.meta);
      } else {
        // Batch logs
        const batchMessage = `Batch of ${logs.length} ${level} logs`;
        const batchMeta = { logs };
        this.logger.log(level, batchMessage, batchMeta);
      }
    });
  }

  /**
   * Log a message
   * @param level Log level
   * @param message Message to log
   * @param meta Additional metadata
   */
  public log(level: string, message: string, meta: any = {}): void {
    // Add to queue
    this.logQueue.push({
      level,
      message,
      meta,
      timestamp: new Date().toISOString(),
    });

    // Flush if queue is full
    if (this.logQueue.length >= this.MAX_QUEUE_SIZE) {
      this.flush();
    }
  }

  /**
   * Log an error
   * @param category Log category
   * @param severity Log severity
   * @param message Message to log
   * @param meta Additional metadata
   */
  public error(
    category: string,
    severity: string,
    message: string,
    meta: any = {}
  ): void {
    // Check cache to avoid duplicate error logging
    const cacheManager = getCacheManager();
    const cacheKey = `error:${category}:${message}`;
    const cachedError = cacheManager.get<number>(cacheKey);

    if (cachedError) {
      // Increment count for duplicate errors
      cacheManager.set(cacheKey, cachedError + 1, 300); // 5 minutes TTL
      return;
    }

    // Cache this error to prevent duplicates
    cacheManager.set(cacheKey, 1, 300); // 5 minutes TTL

    // Add to queue with enhanced metadata
    this.log(OptimizedLogger.LEVELS.ERROR, message, {
      ...meta,
      category,
      severity,
    });
  }

  /**
   * Log a warning
   * @param category Log category
   * @param message Message to log
   * @param meta Additional metadata
   */
  public warn(category: string, message: string, meta: any = {}): void {
    this.log(OptimizedLogger.LEVELS.WARN, message, {
      ...meta,
      category,
    });
  }

  /**
   * Log an info message
   * @param category Log category
   * @param message Message to log
   * @param meta Additional metadata
   */
  public info(category: string, message: string, meta: any = {}): void {
    this.log(OptimizedLogger.LEVELS.INFO, message, {
      ...meta,
      category,
    });
  }

  /**
   * Log a debug message
   * @param category Log category
   * @param message Message to log
   * @param meta Additional metadata
   */
  public debug(category: string, message: string, meta: any = {}): void {
    this.log(OptimizedLogger.LEVELS.DEBUG, message, {
      ...meta,
      category,
    });
  }

  /**
   * Log a database error
   * @param severity Log severity
   * @param message Message to log
   * @param meta Additional metadata
   */
  public databaseError(
    severity: string,
    message: string,
    meta: any = {}
  ): void {
    this.error(OptimizedLogger.CATEGORIES.DATABASE, severity, message, meta);
  }

  /**
   * Log a database warning
   * @param message Message to log
   * @param meta Additional metadata
   */
  public databaseWarn(message: string, meta: any = {}): void {
    this.warn(OptimizedLogger.CATEGORIES.DATABASE, message, meta);
  }

  /**
   * Log a database info message
   * @param message Message to log
   * @param meta Additional metadata
   */
  public databaseInfo(message: string, meta: any = {}): void {
    this.info(OptimizedLogger.CATEGORIES.DATABASE, message, meta);
  }

  /**
   * Log an API error
   * @param severity Log severity
   * @param message Message to log
   * @param meta Additional metadata
   */
  public apiError(severity: string, message: string, meta: any = {}): void {
    this.error(OptimizedLogger.CATEGORIES.API, severity, message, meta);
  }

  /**
   * Log a schema error
   * @param severity Log severity
   * @param message Message to log
   * @param meta Additional metadata
   */
  public schemaError(severity: string, message: string, meta: any = {}): void {
    this.error(OptimizedLogger.CATEGORIES.SCHEMA, severity, message, meta);
  }

  /**
   * Log a file error
   * @param severity Log severity
   * @param message Message to log
   * @param meta Additional metadata
   */
  public fileError(severity: string, message: string, meta: any = {}): void {
    this.error(OptimizedLogger.CATEGORIES.FILE, severity, message, meta);
  }

  /**
   * Shutdown the logger
   */
  public shutdown(): void {
    // Flush any remaining logs
    this.flush();

    // Clear the flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}

// Export a singleton instance
export const getLogger = (): OptimizedLogger => {
  return OptimizedLogger.getInstance();
};

import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";
import fs from "fs";
import { getLogConfig } from "./logConfig";

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log level colors
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

// Add colors to Winston
winston.addColors(colors);

// Get logging configuration
const logConfig = getLogConfig();

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), logConfig.logDir);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.metadata({
    fillExcept: ["message", "level", "timestamp", "label"],
  }),
  winston.format.printf((info: winston.Logform.TransformableInfo) => {
    const { timestamp, level, message } = info;
    // Use type assertion for metadata which is added by the metadata format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = (info as any).metadata || {};
    const metaStr = Object.keys(metadata).length
      ? `\n${JSON.stringify(metadata, null, 2)}`
      : "";
    return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
  })
);

// Define console format (with colors)
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.metadata({
    fillExcept: ["message", "level", "timestamp", "label"],
  }),
  winston.format.printf((info: winston.Logform.TransformableInfo) => {
    const { timestamp, level, message } = info;
    // Use type assertion for metadata which is added by the metadata format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = (info as any).metadata || {};
    const metaStr = Object.keys(metadata).length
      ? `\n${JSON.stringify(metadata, null, 2)}`
      : "";
    return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
  })
);

// Create transports array
const transports: winston.transport[] = [];

// Add file transports if enabled
if (logConfig.enableFileLogging) {
  // Create a daily rotate file transport for all logs
  const allFileTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logsDir, "application-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: logConfig.maxLogSize,
    maxFiles: logConfig.maxLogAge,
    level: logConfig.logLevel,
  });

  // Create a daily rotate file transport for error logs
  const errorFileTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logsDir, "error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: logConfig.maxLogSize,
    maxFiles: logConfig.maxLogAge,
    level: "error",
  });

  transports.push(allFileTransport, errorFileTransport);
}

// Add console transport if enabled
if (logConfig.enableConsoleLogging) {
  const consoleTransport = new winston.transports.Console({
    format: consoleFormat,
    level: logConfig.logLevel,
  });

  transports.push(consoleTransport);
}

// Create the Winston logger
const winstonLogger = winston.createLogger({
  level: logConfig.logLevel,
  levels,
  format,
  transports,
  exitOnError: false,
});

// Add debug mode methods
const isDebugEnabled = () => logConfig.debugMode;

// Create a request context for tracking request-specific data
const requestContext = new Map<string, Record<string, unknown>>();

/**
 * Set context data for a specific request
 * @param requestId Request ID
 * @param data Context data
 */
export const setRequestContext = (
  requestId: string,
  data: Record<string, unknown>
) => {
  requestContext.set(requestId, { ...getRequestContext(requestId), ...data });
};

/**
 * Get context data for a specific request
 * @param requestId Request ID
 * @returns Context data
 */
export const getRequestContext = (
  requestId: string
): Record<string, unknown> => {
  return requestContext.get(requestId) || {};
};

/**
 * Clear context data for a specific request
 * @param requestId Request ID
 */
export const clearRequestContext = (requestId: string) => {
  requestContext.delete(requestId);
};

/**
 * Generate a unique request ID
 * @returns Request ID
 */
export const generateRequestId = (): string => {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Log a message with context data
 * @param level Log level
 * @param message Log message
 * @param requestId Request ID (optional)
 * @param context Additional context data (optional)
 */
export const log = (
  level: keyof typeof levels,
  message: string,
  requestId?: string,
  context?: Record<string, unknown>
) => {
  const metadata: Record<string, unknown> = { ...context };

  // Add request context if available
  if (requestId) {
    metadata.requestId = requestId;
    const reqContext = getRequestContext(requestId);
    Object.assign(metadata, reqContext);
  }

  // Add user ID if available
  if (metadata.userId) {
    metadata.userId = metadata.userId;
  }

  // Log the message
  winstonLogger.log(level, message, metadata);
};

// Convenience methods for different log levels
export const error = (
  message: string,
  requestId?: string,
  context?: Record<string, unknown>
) => log("error", message, requestId, context);

export const warn = (
  message: string,
  requestId?: string,
  context?: Record<string, unknown>
) => log("warn", message, requestId, context);

export const info = (
  message: string,
  requestId?: string,
  context?: Record<string, unknown>
) => log("info", message, requestId, context);

export const http = (
  message: string,
  requestId?: string,
  context?: Record<string, unknown>
) => log("http", message, requestId, context);

export const debug = (
  message: string,
  requestId?: string,
  context?: Record<string, unknown>
) => log("debug", message, requestId, context);

// Create a named object for export
const logger = {
  log,
  error,
  warn,
  info,
  http,
  debug,
  setRequestContext,
  getRequestContext,
  clearRequestContext,
  generateRequestId,
  isDebugEnabled,
};

// Export the logger
export default logger;

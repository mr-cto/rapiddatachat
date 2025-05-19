/**
 * Enhanced logging utility with log levels and formatting
 * Reduces log noise by filtering based on configured log level
 */

// Define log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

// Default log level from environment or INFO
const DEFAULT_LOG_LEVEL = process.env.LOG_LEVEL
  ? LogLevel[process.env.LOG_LEVEL.toUpperCase() as keyof typeof LogLevel] ??
    LogLevel.INFO
  : LogLevel.INFO;

// Current log level
let currentLogLevel = DEFAULT_LOG_LEVEL;

/**
 * Set the current log level
 * @param level Log level to set
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Get the current log level
 * @returns Current log level
 */
export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

/**
 * Format a log message with timestamp and category
 * @param level Log level
 * @param category Log category
 * @param message Log message
 * @returns Formatted log message
 */
function formatLogMessage(
  level: string,
  category: string,
  message: string
): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] [${category}] ${message}`;
}

/**
 * Log a message if the level is less than or equal to the current log level
 * @param level Log level
 * @param category Log category
 * @param message Log message
 * @param data Optional data to log
 */
export function log(
  level: LogLevel,
  category: string,
  message: string,
  data?: any
): void {
  if (level <= currentLogLevel) {
    const levelName = LogLevel[level];
    const formattedMessage = formatLogMessage(levelName, category, message);

    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage, data !== undefined ? data : "");
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, data !== undefined ? data : "");
        break;
      default:
        console.log(formattedMessage, data !== undefined ? data : "");
        break;
    }
  }
}

/**
 * Log an error message
 * @param category Log category
 * @param message Log message
 * @param data Optional data to log
 */
export function error(category: string, message: string, data?: any): void {
  log(LogLevel.ERROR, category, message, data);
}

/**
 * Log a warning message
 * @param category Log category
 * @param message Log message
 * @param data Optional data to log
 */
export function warn(category: string, message: string, data?: any): void {
  log(LogLevel.WARN, category, message, data);
}

/**
 * Log an info message
 * @param category Log category
 * @param message Log message
 * @param data Optional data to log
 */
export function info(category: string, message: string, data?: any): void {
  log(LogLevel.INFO, category, message, data);
}

/**
 * Log a debug message
 * @param category Log category
 * @param message Log message
 * @param data Optional data to log
 */
export function debug(category: string, message: string, data?: any): void {
  log(LogLevel.DEBUG, category, message, data);
}

/**
 * Log a trace message
 * @param category Log category
 * @param message Log message
 * @param data Optional data to log
 */
export function trace(category: string, message: string, data?: any): void {
  log(LogLevel.TRACE, category, message, data);
}

// Create a logger for a specific category
export function createLogger(category: string) {
  return {
    error: (message: string, data?: any) => error(category, message, data),
    warn: (message: string, data?: any) => warn(category, message, data),
    info: (message: string, data?: any) => info(category, message, data),
    debug: (message: string, data?: any) => debug(category, message, data),
    trace: (message: string, data?: any) => trace(category, message, data),
  };
}

// Default export
export default {
  LogLevel,
  setLogLevel,
  getLogLevel,
  log,
  error,
  warn,
  info,
  debug,
  trace,
  createLogger,
};

/**
 * Logging configuration
 */
interface LogConfig {
  /** Enable debug mode */
  debugMode: boolean;
  /** Log level (error, warn, info, http, debug) */
  logLevel: string;
  /** Enable file logging */
  enableFileLogging: boolean;
  /** Enable console logging */
  enableConsoleLogging: boolean;
  /** Log directory */
  logDir: string;
  /** Maximum log file size */
  maxLogSize: string;
  /** Maximum log file age */
  maxLogAge: string;
  /** Enable request logging */
  enableRequestLogging: boolean;
  /** Enable response logging */
  enableResponseLogging: boolean;
  /** Enable error logging */
  enableErrorLogging: boolean;
  /** Enable performance logging */
  enablePerformanceLogging: boolean;
  /** Enable query logging */
  enableQueryLogging: boolean;
  /** Enable file operation logging */
  enableFileOperationLogging: boolean;
}

/**
 * Default logging configuration
 */
const defaultConfig: LogConfig = {
  debugMode:
    process.env.DEBUG_MODE === "true" || process.env.NODE_ENV !== "production",
  logLevel:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
  enableFileLogging: process.env.ENABLE_FILE_LOGGING !== "false",
  enableConsoleLogging: true,
  logDir: process.env.LOG_DIR || "logs",
  maxLogSize: process.env.MAX_LOG_SIZE || "20m",
  maxLogAge: process.env.MAX_LOG_AGE || "14d",
  enableRequestLogging: true,
  enableResponseLogging: true,
  enableErrorLogging: true,
  enablePerformanceLogging: process.env.ENABLE_PERFORMANCE_LOGGING !== "false",
  enableQueryLogging: process.env.ENABLE_QUERY_LOGGING !== "false",
  enableFileOperationLogging:
    process.env.ENABLE_FILE_OPERATION_LOGGING !== "false",
};

/**
 * Current logging configuration
 */
let currentConfig: LogConfig = { ...defaultConfig };

/**
 * Get the current logging configuration
 * @returns Current logging configuration
 */
export const getLogConfig = (): LogConfig => {
  return { ...currentConfig };
};

/**
 * Update the logging configuration
 * @param config New logging configuration
 * @returns Updated logging configuration
 */
export const updateLogConfig = (config: Partial<LogConfig>): LogConfig => {
  currentConfig = { ...currentConfig, ...config };
  return { ...currentConfig };
};

/**
 * Enable debug mode
 */
export const enableDebugMode = (): void => {
  currentConfig.debugMode = true;
  currentConfig.logLevel = "debug";
};

/**
 * Disable debug mode
 */
export const disableDebugMode = (): void => {
  currentConfig.debugMode = false;
  currentConfig.logLevel =
    process.env.NODE_ENV === "production" ? "info" : "debug";
};

/**
 * Check if debug mode is enabled
 * @returns True if debug mode is enabled
 */
export const isDebugMode = (): boolean => {
  return currentConfig.debugMode;
};

/**
 * Reset logging configuration to defaults
 * @returns Default logging configuration
 */
export const resetLogConfig = (): LogConfig => {
  currentConfig = { ...defaultConfig };
  return { ...currentConfig };
};

// Create a named object for export
const logConfig = {
  getLogConfig,
  updateLogConfig,
  enableDebugMode,
  disableDebugMode,
  isDebugMode,
  resetLogConfig,
};

export default logConfig;

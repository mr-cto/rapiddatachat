/**
 * Error handling utilities for the NL-to-SQL system
 */

// Define error types
export enum NLToSQLErrorType {
  VALIDATION = "validation",
  TIMEOUT = "timeout",
  PERMISSION = "permission",
  NOT_FOUND = "not_found",
  SYNTAX = "syntax",
  EXECUTION = "execution",
  UNKNOWN = "unknown",
}

// Define error interface
export interface NLToSQLError {
  type: NLToSQLErrorType;
  message: string;
  details?: string;
  statusCode: number;
}

/**
 * Create a NL-to-SQL error
 * @param type Error type
 * @param message Error message
 * @param details Error details
 * @returns NLToSQLError
 */
export function createNLToSQLError(
  type: NLToSQLErrorType,
  message: string,
  details?: string
): NLToSQLError {
  // Determine status code based on error type
  let statusCode = 500;
  switch (type) {
    case NLToSQLErrorType.VALIDATION:
      statusCode = 400;
      break;
    case NLToSQLErrorType.TIMEOUT:
      statusCode = 408;
      break;
    case NLToSQLErrorType.PERMISSION:
      statusCode = 403;
      break;
    case NLToSQLErrorType.NOT_FOUND:
      statusCode = 404;
      break;
    case NLToSQLErrorType.SYNTAX:
      statusCode = 400;
      break;
    case NLToSQLErrorType.EXECUTION:
      statusCode = 500;
      break;
    case NLToSQLErrorType.UNKNOWN:
    default:
      statusCode = 500;
      break;
  }

  return {
    type,
    message,
    details,
    statusCode,
  };
}

/**
 * Determine error type from error message
 * @param error Error object or message
 * @returns NLToSQLErrorType
 */
export function determineErrorType(error: Error | string): NLToSQLErrorType {
  const message = typeof error === "string" ? error : error.message;

  if (message.includes("validation") || message.includes("invalid")) {
    return NLToSQLErrorType.VALIDATION;
  } else if (message.includes("timeout") || message.includes("timed out")) {
    return NLToSQLErrorType.TIMEOUT;
  } else if (
    message.includes("permission") ||
    message.includes("access") ||
    message.includes("unauthorized")
  ) {
    return NLToSQLErrorType.PERMISSION;
  } else if (
    message.includes("not found") ||
    message.includes("doesn't exist") ||
    message.includes("does not exist")
  ) {
    return NLToSQLErrorType.NOT_FOUND;
  } else if (message.includes("syntax") || message.includes("parse")) {
    return NLToSQLErrorType.SYNTAX;
  } else if (
    message.includes("execution") ||
    message.includes("failed to execute")
  ) {
    return NLToSQLErrorType.EXECUTION;
  } else {
    return NLToSQLErrorType.UNKNOWN;
  }
}

/**
 * Handle an error and return a standardized NLToSQLError
 * @param error Error object or message
 * @param defaultMessage Default error message
 * @returns NLToSQLError
 */
export function handleNLToSQLError(
  error: unknown,
  defaultMessage = "An error occurred"
): NLToSQLError {
  // Handle different error types
  if (error instanceof Error) {
    const errorType = determineErrorType(error);
    return createNLToSQLError(errorType, defaultMessage, error.message);
  } else if (typeof error === "string") {
    const errorType = determineErrorType(error);
    return createNLToSQLError(errorType, defaultMessage, error);
  } else {
    return createNLToSQLError(NLToSQLErrorType.UNKNOWN, defaultMessage);
  }
}

/**
 * Format error for API response
 * @param error NLToSQLError
 * @returns API response error object
 */
export function formatErrorForResponse(error: NLToSQLError): {
  error: string;
  details?: string;
  code: number;
  type: string;
} {
  return {
    error: error.message,
    details: error.details,
    code: error.statusCode,
    type: error.type,
  };
}

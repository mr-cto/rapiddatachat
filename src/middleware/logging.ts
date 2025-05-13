import { NextApiRequest, NextApiResponse } from "next";
import logger, { generateRequestId } from "../../lib/logger";

/**
 * Type for Next.js API handler
 */
type NextApiHandler = (
  req: NextApiRequest,
  res: NextApiResponse
) => Promise<void> | void;

/**
 * Middleware to add logging to API routes
 * @param handler Next.js API handler
 * @returns Enhanced handler with logging
 */
export const withLogging = (handler: NextApiHandler): NextApiHandler => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Generate a unique request ID
    const requestId = generateRequestId();

    // Get user information if available
    const user = (
      req as { session?: { user?: { id?: string; email?: string } } }
    ).session?.user;
    const userId = user?.id || user?.email || "anonymous";

    // Set up request context
    logger.setRequestContext(requestId, {
      userId,
      method: req.method,
      url: req.url,
      userAgent: req.headers["user-agent"],
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    });

    // Log the request
    logger.info(`API Request: ${req.method} ${req.url}`, requestId, {
      query: req.query,
      body: req.body ? sanitizeBody(req.body) : undefined,
      headers: sanitizeHeaders(req.headers),
    });

    // Create a custom response object to intercept the response
    const originalEnd = res.end;
    const originalJson = res.json;
    const originalStatus = res.status;

    let statusCode = 200;

    // Override status method
    res.status = (code) => {
      statusCode = code;
      return originalStatus.call(res, code);
    };

    // Override json method
    res.json = (body) => {
      // Log the response
      logger.info(`API Response: ${statusCode}`, requestId, {
        statusCode,
        body: sanitizeBody(body),
      });

      // Clean up request context
      logger.clearRequestContext(requestId);

      return originalJson.call(res, body);
    };

    // Override end method
    // Using any type to avoid complex type issues with res.end overloads
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.end = function (this: any, ...args: any[]) {
      const chunk = args[0];
      // Unused variables but kept for clarity
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const encoding = args[1];
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const callback = args[2];

      // Log the response if it hasn't been logged by res.json
      if (chunk && typeof chunk !== "function") {
        logger.info(`API Response: ${statusCode}`, requestId, {
          statusCode,
          chunk: typeof chunk === "string" ? chunk : "Binary data",
        });
      }

      // Clean up request context
      logger.clearRequestContext(requestId);

      // Call the original end method with the same arguments
      // @ts-expect-error - Suppressing TypeScript errors due to complex overload types
      return originalEnd.apply(this, args);
    };

    try {
      // Call the original handler
      return await handler(req, res);
    } catch (error) {
      // Log the error
      logger.error(
        `API Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        requestId,
        {
          stack: error instanceof Error ? error.stack : undefined,
          statusCode: 500,
        }
      );

      // Clean up request context
      logger.clearRequestContext(requestId);

      // Re-throw the error
      throw error;
    }
  };
};

/**
 * Sanitize request/response body to remove sensitive information
 * @param body Request or response body
 * @returns Sanitized body
 */
const sanitizeBody = (body: unknown): unknown => {
  if (!body || typeof body !== "object" || body === null) return body;

  // Create a copy of the body
  const sanitized = { ...(body as Record<string, unknown>) };

  // Remove sensitive fields
  const sensitiveFields = [
    "password",
    "token",
    "apiKey",
    "secret",
    "authorization",
  ];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }

  return sanitized;
};

/**
 * Sanitize request headers to remove sensitive information
 * @param headers Request headers
 * @returns Sanitized headers
 */
const sanitizeHeaders = (headers: unknown): unknown => {
  if (!headers || typeof headers !== "object" || headers === null)
    return headers;

  // Create a copy of the headers
  const sanitized = { ...(headers as Record<string, unknown>) };

  // Remove sensitive fields
  const sensitiveFields = [
    "authorization",
    "cookie",
    "x-api-key",
    "x-auth-token",
  ];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }

  return sanitized;
};

export default withLogging;

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../authOptions";
import { getCachedSession, cacheSession } from "../authCache";
import logger from "../logging/logger";

// Create a logger for auth middleware
const log = logger.createLogger("AuthMiddleware");

/**
 * Type for the handler function that will be wrapped by the middleware
 */
type ApiHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) => Promise<void>;

/**
 * Middleware to handle authentication for API routes
 * Uses session caching to reduce authentication overhead
 *
 * @param handler The API handler function to wrap
 * @returns A new handler function that includes authentication
 */
export function withAuth(handler: ApiHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Check for session token in cookies
      const sessionToken = req.cookies["next-auth.session-token"];

      // Try to get user from cache first
      let userId: string | null = null;

      if (sessionToken) {
        const cachedUser = getCachedSession(sessionToken);
        if (cachedUser) {
          log.debug("Using cached session");
          userId = cachedUser.id;
        }
      }

      // If not in cache, do the full authentication
      if (!userId) {
        log.debug("No cached session found, authenticating with NextAuth");
        const session = await getServerSession(req, res, authOptions);

        if (!session?.user?.id) {
          log.warn("Unauthorized access attempt");
          return res.status(401).json({ error: "Unauthorized" });
        }

        userId = session.user.id;

        // Cache the session for future requests
        if (sessionToken) {
          cacheSession(sessionToken, session.user);
          log.debug("Session cached for future requests");
        }
      }

      // Call the handler with the authenticated user ID
      return await handler(req, res, userId);
    } catch (error) {
      log.error("Authentication error", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}

/**
 * Middleware to handle optional authentication for API routes
 * User ID will be null if not authenticated
 *
 * @param handler The API handler function to wrap
 * @returns A new handler function that includes optional authentication
 */
export function withOptionalAuth(
  handler: (
    req: NextApiRequest,
    res: NextApiResponse,
    userId: string | null
  ) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Check for session token in cookies
      const sessionToken = req.cookies["next-auth.session-token"];

      // Try to get user from cache first
      let userId: string | null = null;

      if (sessionToken) {
        const cachedUser = getCachedSession(sessionToken);
        if (cachedUser) {
          log.debug("Using cached session (optional auth)");
          userId = cachedUser.id;
        }
      }

      // If not in cache, do the full authentication
      if (!userId && sessionToken) {
        log.debug(
          "No cached session found, authenticating with NextAuth (optional auth)"
        );
        const session = await getServerSession(req, res, authOptions);

        if (session?.user?.id) {
          userId = session.user.id;

          // Cache the session for future requests
          cacheSession(sessionToken, session.user);
          log.debug("Session cached for future requests (optional auth)");
        }
      }

      // Call the handler with the user ID (which may be null)
      return await handler(req, res, userId);
    } catch (error) {
      log.error("Authentication error (optional auth)", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}

/**
 * Middleware for development environments that skips authentication
 * Only use this in development!
 *
 * @param handler The API handler function to wrap
 * @returns A new handler function that includes mock authentication
 */
export function withDevAuth(handler: ApiHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Only allow in development
    if (process.env.NODE_ENV !== "development") {
      log.error(
        "Attempted to use development auth in non-development environment"
      );
      return res.status(401).json({ error: "Unauthorized" });
    }

    log.warn("Using development authentication - no real auth check performed");

    // Use a mock user ID
    const mockUserId = "dev-user-id";

    // Call the handler with the mock user ID
    return await handler(req, res, mockUserId);
  };
}

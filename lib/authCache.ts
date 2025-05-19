/**
 * Simple in-memory cache for authenticated sessions
 * Reduces overhead from repeated authentication checks
 */

interface CachedSession {
  user: any;
  expiry: number;
}

// Cache map with session token as key
const sessionCache = new Map<string, CachedSession>();

// Default cache expiry time (5 minutes)
const DEFAULT_CACHE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Get a cached session if available
 * @param sessionToken Session token from cookie
 * @returns Cached user or null if not found or expired
 */
export function getCachedSession(sessionToken: string): any | null {
  if (!sessionToken) return null;

  const cached = sessionCache.get(sessionToken);
  if (cached && cached.expiry > Date.now()) {
    return cached.user;
  }

  return null;
}

/**
 * Cache a user session
 * @param sessionToken Session token from cookie
 * @param user User object to cache
 * @param expiryMs Optional expiry time in milliseconds (default: 5 minutes)
 */
export function cacheSession(
  sessionToken: string,
  user: any,
  expiryMs: number = DEFAULT_CACHE_EXPIRY_MS
): void {
  if (!sessionToken || !user) return;

  sessionCache.set(sessionToken, {
    user,
    expiry: Date.now() + expiryMs,
  });
}

/**
 * Clear a specific session from cache
 * @param sessionToken Session token to clear
 */
export function clearCachedSession(sessionToken: string): void {
  sessionCache.delete(sessionToken);
}

/**
 * Clear all expired sessions from cache
 */
export function clearExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of sessionCache.entries()) {
    if (session.expiry <= now) {
      sessionCache.delete(token);
    }
  }
}

// Periodically clean up expired sessions (every 15 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(clearExpiredSessions, 15 * 60 * 1000);
}

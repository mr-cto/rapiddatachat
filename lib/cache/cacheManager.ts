import NodeCache from "node-cache";

/**
 * Cache manager for database query results
 * Implements a multi-level caching system for frequently accessed data
 */
export class CacheManager {
  private static instance: CacheManager;
  private cache: NodeCache;

  // Cache TTL values in seconds
  private static readonly DEFAULT_TTL = 300; // 5 minutes
  private static readonly SCHEMA_TTL = 600; // 10 minutes
  private static readonly COLUMN_MAPPING_TTL = 600; // 10 minutes
  private static readonly PROJECT_TTL = 300; // 5 minutes

  private constructor() {
    // Initialize the cache with standard settings
    this.cache = new NodeCache({
      stdTTL: CacheManager.DEFAULT_TTL,
      checkperiod: 60, // Check for expired keys every 60 seconds
      useClones: false, // Don't clone objects (for performance)
    });

    console.log("[CacheManager] Initialized");
  }

  /**
   * Get the singleton instance of the cache manager
   * @returns CacheManager instance
   */
  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns Cached value or undefined if not found
   */
  public get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in seconds (optional)
   * @returns true if successful, false otherwise
   */
  public set<T>(key: string, value: T, ttl?: number): boolean {
    if (ttl !== undefined) {
      return this.cache.set(key, value, ttl);
    }
    return this.cache.set(key, value);
  }

  /**
   * Delete a value from the cache
   * @param key Cache key
   * @returns true if successful, false otherwise
   */
  public delete(key: string): boolean {
    return this.cache.del(key) > 0;
  }

  /**
   * Clear all values from the cache
   */
  public clear(): void {
    this.cache.flushAll();
  }

  /**
   * Get a value from the cache or compute it if not found
   * @param key Cache key
   * @param fn Function to compute the value if not found
   * @param ttl Time to live in seconds (optional)
   * @returns Cached or computed value
   */
  public async getOrCompute<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cachedValue = this.get<T>(key);

    if (cachedValue !== undefined) {
      console.log(`[CacheManager] Cache hit for key: ${key}`);
      return cachedValue;
    }

    console.log(`[CacheManager] Cache miss for key: ${key}`);
    const computedValue = await fn();
    this.set(key, computedValue, ttl);
    return computedValue;
  }

  /**
   * Invalidate cache entries by prefix
   * @param prefix Cache key prefix
   */
  public invalidateByPrefix(prefix: string): void {
    const keys = this.cache.keys().filter((key) => key.startsWith(prefix));
    if (keys.length > 0) {
      console.log(
        `[CacheManager] Invalidating ${keys.length} keys with prefix: ${prefix}`
      );
      this.cache.del(keys);
    }
  }

  /**
   * Get schema cache TTL
   * @returns Schema cache TTL in seconds
   */
  public getSchemaTTL(): number {
    return CacheManager.SCHEMA_TTL;
  }

  /**
   * Get column mapping cache TTL
   * @returns Column mapping cache TTL in seconds
   */
  public getColumnMappingTTL(): number {
    return CacheManager.COLUMN_MAPPING_TTL;
  }

  /**
   * Get project cache TTL
   * @returns Project cache TTL in seconds
   */
  public getProjectTTL(): number {
    return CacheManager.PROJECT_TTL;
  }
}

// Export a singleton instance
export const getCacheManager = (): CacheManager => {
  return CacheManager.getInstance();
};

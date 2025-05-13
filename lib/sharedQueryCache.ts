import NodeCache from "node-cache";

/**
 * Cache configuration options
 */
interface CacheConfig {
  /** Time to live in seconds (default: 1 hour) */
  ttl?: number;
  /** Maximum number of items in cache (default: 1000) */
  maxItems?: number;
  /** Check period in seconds (default: 5 minutes) */
  checkPeriod?: number;
}

/**
 * Shared query data structure
 */
export interface SharedQueryData {
  id: string;
  naturalLanguageQuery: string;
  sqlQuery: string;
  results: Record<string, unknown>[];
  timestamp: Date;
  executionTime?: number;
  userId?: string;
  expiresAt?: Date;
  accessCount?: number;
  columnMerges?: {
    id: string;
    mergeName: string;
    columnList: string[];
    delimiter: string;
  }[];
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  ksize: number;
  vsize: number;
}

/**
 * SharedQueryCache class for caching shared query results
 * This service provides caching for shared query results with TTL, size limits, and statistics
 */
export class SharedQueryCache {
  private cache: NodeCache;
  private hits: number = 0;
  private misses: number = 0;
  private readonly defaultTTL: number;
  private readonly maxItems: number;

  /**
   * Constructor for SharedQueryCache
   * @param config Cache configuration
   */
  constructor(config: CacheConfig = {}) {
    this.defaultTTL = config.ttl || 3600; // 1 hour default TTL
    this.maxItems = config.maxItems || 1000; // 1000 items default max

    this.cache = new NodeCache({
      stdTTL: this.defaultTTL,
      checkperiod: config.checkPeriod || 300, // 5 minutes default check period
      maxKeys: this.maxItems,
      useClones: false, // For better performance
    });

    // Set up automatic cleanup
    this.cache.on("expired", (key: string) => {
      console.log(`Cache item expired: ${key}`);
    });
  }

  /**
   * Set a shared query in the cache
   * @param id Shared query ID
   * @param data Shared query data
   * @param ttl Time to live in seconds (optional, defaults to constructor value)
   * @returns boolean indicating success
   */
  set(id: string, data: SharedQueryData, ttl?: number): boolean {
    // Don't cache if we're at the limit
    if (this.cache.keys().length >= this.maxItems && !this.cache.has(id)) {
      console.warn("Cache limit reached, not caching new item");
      return false;
    }

    return this.cache.set(id, data, ttl || this.defaultTTL);
  }

  /**
   * Get a shared query from the cache
   * @param id Shared query ID
   * @returns SharedQueryData or undefined if not found
   */
  get(id: string): SharedQueryData | undefined {
    const data = this.cache.get<SharedQueryData>(id);

    if (data) {
      this.hits++;

      // Update access count
      if (data.accessCount !== undefined) {
        data.accessCount++;
      } else {
        data.accessCount = 1;
      }

      return data;
    }

    this.misses++;
    return undefined;
  }

  /**
   * Check if a shared query exists in the cache
   * @param id Shared query ID
   * @returns boolean indicating if the item exists
   */
  has(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Delete a shared query from the cache
   * @param id Shared query ID
   * @returns boolean indicating success
   */
  delete(id: string): boolean {
    return this.cache.del(id) > 0;
  }

  /**
   * Clear all shared queries from the cache
   */
  clear(): void {
    this.cache.flushAll();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   * @returns CacheStats object
   */
  getStats(): CacheStats {
    const stats = this.cache.getStats();
    return {
      hits: this.hits,
      misses: this.misses,
      keys: stats.keys,
      ksize: stats.ksize,
      vsize: stats.vsize,
    };
  }

  /**
   * Set expiration for a shared query
   * @param id Shared query ID
   * @param ttl Time to live in seconds
   * @returns boolean indicating success
   */
  setExpiration(id: string, ttl: number): boolean {
    return this.cache.ttl(id, ttl);
  }

  /**
   * Get all shared queries for a user
   * @param userId User ID
   * @returns Array of SharedQueryData
   */
  getUserSharedQueries(userId: string): SharedQueryData[] {
    if (!userId) return [];

    return this.cache
      .keys()
      .map((key: string) => this.cache.get<SharedQueryData>(key))
      .filter(
        (data: SharedQueryData | undefined): data is SharedQueryData =>
          data !== undefined && data.userId === userId
      );
  }

  /**
   * Prune expired or least recently used items if cache is full
   * @param count Number of items to prune (default: 10% of max)
   */
  prune(count?: number): void {
    const keys = this.cache.keys();
    if (keys.length < this.maxItems) return;

    const pruneCount = count || Math.ceil(this.maxItems * 0.1); // Default to 10% of max

    // Get all items with their metadata
    const items = keys.map((key: string) => {
      const data = this.cache.get<SharedQueryData>(key);
      return {
        key,
        accessCount: data?.accessCount || 0,
        timestamp: data?.timestamp || new Date(0),
      };
    });

    // Sort by access count (ascending) and then by age (oldest first)
    items.sort(
      (
        a: { key: string; accessCount: number; timestamp: Date },
        b: { key: string; accessCount: number; timestamp: Date }
      ) => {
        if (a.accessCount !== b.accessCount) {
          return a.accessCount - b.accessCount;
        }
        return a.timestamp.getTime() - b.timestamp.getTime();
      }
    );

    // Delete the least used/oldest items
    items.slice(0, pruneCount).forEach((item: { key: string }) => {
      this.cache.del(item.key);
    });

    console.log(`Pruned ${pruneCount} items from cache`);
  }
}

// Create a singleton instance with default settings
const sharedQueryCache = new SharedQueryCache();

export default sharedQueryCache;

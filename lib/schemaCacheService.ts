import { GlobalSchema, SchemaColumn } from "./globalSchemaService";
import NodeCache from "node-cache";

/**
 * Interface for schema cache options
 */
interface SchemaCacheOptions {
  stdTTL?: number; // Standard TTL in seconds
  checkperiod?: number; // Period in seconds to check for expired keys
  maxKeys?: number; // Maximum number of keys in the cache
}

/**
 * Interface for schema cache stats
 */
interface SchemaCacheStats {
  hits: number;
  misses: number;
  keys: number;
  ksize: number;
  vsize: number;
}

/**
 * SchemaCacheService class for caching schema information
 */
export class SchemaCacheService {
  private cache: NodeCache;
  private stats: {
    hits: number;
    misses: number;
  };

  /**
   * Constructor
   * @param options Cache options
   */
  constructor(options: SchemaCacheOptions = {}) {
    // Default options
    const defaultOptions: SchemaCacheOptions = {
      stdTTL: 300, // 5 minutes
      checkperiod: 60, // 1 minute
      maxKeys: 1000,
    };

    // Merge options
    const mergedOptions = { ...defaultOptions, ...options };

    // Create cache
    this.cache = new NodeCache({
      stdTTL: mergedOptions.stdTTL,
      checkperiod: mergedOptions.checkperiod,
      maxKeys: mergedOptions.maxKeys,
    });

    // Initialize stats
    this.stats = {
      hits: 0,
      misses: 0,
    };

    // Log cache creation
    console.log(
      `[SchemaCacheService] Cache created with options: ${JSON.stringify(
        mergedOptions
      )}`
    );
  }

  /**
   * Get a schema from the cache
   * @param key Cache key
   * @returns Schema or undefined if not found
   */
  getSchema(key: string): GlobalSchema | undefined {
    const schema = this.cache.get<GlobalSchema>(this.getSchemaKey(key));

    if (schema) {
      this.stats.hits++;
      return schema;
    } else {
      this.stats.misses++;
      return undefined;
    }
  }

  /**
   * Set a schema in the cache
   * @param key Cache key
   * @param schema Schema to cache
   * @param ttl TTL in seconds (optional)
   * @returns True if successful
   */
  setSchema(key: string, schema: GlobalSchema, ttl?: number): boolean {
    if (ttl !== undefined) {
      return this.cache.set(this.getSchemaKey(key), schema, ttl);
    } else {
      return this.cache.set(this.getSchemaKey(key), schema);
    }
  }

  /**
   * Delete a schema from the cache
   * @param key Cache key
   * @returns Number of deleted entries
   */
  deleteSchema(key: string): number {
    return this.cache.del(this.getSchemaKey(key));
  }

  /**
   * Get schema columns from the cache
   * @param schemaId Schema ID
   * @returns Schema columns or undefined if not found
   */
  getSchemaColumns(schemaId: string): SchemaColumn[] | undefined {
    const columns = this.cache.get<SchemaColumn[]>(
      this.getColumnsKey(schemaId)
    );

    if (columns) {
      this.stats.hits++;
      return columns;
    } else {
      this.stats.misses++;
      return undefined;
    }
  }

  /**
   * Set schema columns in the cache
   * @param schemaId Schema ID
   * @param columns Schema columns to cache
   * @param ttl TTL in seconds (optional)
   * @returns True if successful
   */
  setSchemaColumns(
    schemaId: string,
    columns: SchemaColumn[],
    ttl?: number
  ): boolean {
    if (ttl !== undefined) {
      return this.cache.set(this.getColumnsKey(schemaId), columns, ttl);
    } else {
      return this.cache.set(this.getColumnsKey(schemaId), columns);
    }
  }

  /**
   * Delete schema columns from the cache
   * @param schemaId Schema ID
   * @returns Number of deleted entries
   */
  deleteSchemaColumns(schemaId: string): number {
    return this.cache.del(this.getColumnsKey(schemaId));
  }

  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns Value or undefined if not found
   */
  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);

    if (value) {
      this.stats.hits++;
      return value;
    } else {
      this.stats.misses++;
      return undefined;
    }
  }

  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl TTL in seconds (optional)
   * @returns True if successful
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    if (ttl !== undefined) {
      return this.cache.set(key, value, ttl);
    } else {
      return this.cache.set(key, value);
    }
  }

  /**
   * Delete a value from the cache
   * @param key Cache key
   * @returns Number of deleted entries
   */
  delete(key: string): number {
    return this.cache.del(key);
  }

  /**
   * Check if a key exists in the cache
   * @param key Cache key
   * @returns True if the key exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get multiple values from the cache
   * @param keys Cache keys
   * @returns Object with key-value pairs
   */
  getMulti<T>(keys: string[]): { [key: string]: T } {
    const values = this.cache.mget<T>(keys);

    // Update stats
    const hits = Object.keys(values).length;
    const misses = keys.length - hits;

    this.stats.hits += hits;
    this.stats.misses += misses;

    return values;
  }

  /**
   * Set multiple values in the cache
   * @param keyValuePairs Object with key-value pairs
   * @param ttl TTL in seconds (optional)
   * @returns True if all values were set successfully
   */
  setMulti<T>(keyValuePairs: { [key: string]: T }, ttl?: number): boolean {
    const entries = Object.entries(keyValuePairs).map(([key, value]) => {
      if (ttl !== undefined) {
        return { key, val: value, ttl };
      } else {
        return { key, val: value };
      }
    });

    return this.cache.mset(entries);
  }

  /**
   * Delete multiple values from the cache
   * @param keys Cache keys
   * @returns Number of deleted entries
   */
  deleteMulti(keys: string[]): number {
    return this.cache.del(keys);
  }

  /**
   * Flush the cache
   */
  flush(): void {
    this.cache.flushAll();
  }

  /**
   * Get cache keys
   * @returns Array of cache keys
   */
  keys(): string[] {
    return this.cache.keys();
  }

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  getStats(): SchemaCacheStats {
    const cacheStats = this.cache.getStats();

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      keys: cacheStats.keys,
      ksize: cacheStats.ksize,
      vsize: cacheStats.vsize,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
    };
  }

  /**
   * Get schema key
   * @param schemaId Schema ID
   * @returns Cache key
   */
  getSchemaKey(schemaId: string): string {
    return `schema:${schemaId}`;
  }

  /**
   * Get columns key
   * @param schemaId Schema ID
   * @returns Cache key
   */
  getColumnsKey(schemaId: string): string {
    return `schema:${schemaId}:columns`;
  }
}

// Create a singleton instance
export const schemaCache = new SchemaCacheService();

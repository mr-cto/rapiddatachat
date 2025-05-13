/**
 * Performance monitoring utilities for the NL-to-SQL system
 */

// Define performance metrics interface
export interface PerformanceMetrics {
  executionTime: number;
  querySize: number;
  resultSize: number;
  timestamp: Date;
  queryId?: string;
  userId?: string;
}

// Define performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  EXECUTION_TIME_WARNING: 800, // ms
  EXECUTION_TIME_CRITICAL: 1200, // ms
  RESULT_SIZE_LARGE: 10000, // rows
  QUERY_SIZE_LARGE: 5000, // characters
};

// In-memory storage for recent performance metrics
const recentMetrics: PerformanceMetrics[] = [];
const MAX_RECENT_METRICS = 100;

/**
 * Record performance metrics for a query
 * @param metrics Performance metrics to record
 */
export function recordPerformanceMetrics(metrics: PerformanceMetrics): void {
  // Add metrics to recent metrics
  recentMetrics.unshift(metrics);

  // Trim recent metrics to max size
  if (recentMetrics.length > MAX_RECENT_METRICS) {
    recentMetrics.pop();
  }

  // Log performance metrics if they exceed thresholds
  if (metrics.executionTime > PERFORMANCE_THRESHOLDS.EXECUTION_TIME_WARNING) {
    if (
      metrics.executionTime > PERFORMANCE_THRESHOLDS.EXECUTION_TIME_CRITICAL
    ) {
      console.warn(
        `CRITICAL: Query execution time (${metrics.executionTime}ms) exceeds critical threshold (${PERFORMANCE_THRESHOLDS.EXECUTION_TIME_CRITICAL}ms)`
      );
    } else {
      console.warn(
        `WARNING: Query execution time (${metrics.executionTime}ms) exceeds warning threshold (${PERFORMANCE_THRESHOLDS.EXECUTION_TIME_WARNING}ms)`
      );
    }
  }

  // TODO: In a production environment, send metrics to a monitoring service
}

/**
 * Get performance metrics for the 95th percentile
 * @returns Performance metrics for the 95th percentile
 */
export function get95thPercentileMetrics(): {
  executionTime: number;
  querySize: number;
  resultSize: number;
} {
  if (recentMetrics.length === 0) {
    return {
      executionTime: 0,
      querySize: 0,
      resultSize: 0,
    };
  }

  // Sort metrics by execution time
  const sortedExecutionTimes = [...recentMetrics].sort(
    (a, b) => a.executionTime - b.executionTime
  );
  const sortedQuerySizes = [...recentMetrics].sort(
    (a, b) => a.querySize - b.querySize
  );
  const sortedResultSizes = [...recentMetrics].sort(
    (a, b) => a.resultSize - b.resultSize
  );

  // Calculate 95th percentile index
  const percentileIndex = Math.floor(sortedExecutionTimes.length * 0.95);

  return {
    executionTime: sortedExecutionTimes[percentileIndex]?.executionTime || 0,
    querySize: sortedQuerySizes[percentileIndex]?.querySize || 0,
    resultSize: sortedResultSizes[percentileIndex]?.resultSize || 0,
  };
}

/**
 * Get all recent performance metrics
 * @returns Recent performance metrics
 */
export function getRecentMetrics(): PerformanceMetrics[] {
  return [...recentMetrics];
}

/**
 * Clear all recent performance metrics
 */
export function clearRecentMetrics(): void {
  recentMetrics.length = 0;
}

/**
 * Performance monitoring decorator for async functions
 * @param target Target object
 * @param propertyKey Method name
 * @param descriptor Method descriptor
 * @returns Modified descriptor
 */
export function monitorPerformance(
  target: Record<string, unknown>,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: unknown[]) {
    const startTime = performance.now();

    try {
      // Execute the original method
      const result = await originalMethod.apply(this, args);

      // Calculate execution time
      const executionTime = performance.now() - startTime;

      // Record performance metrics
      recordPerformanceMetrics({
        executionTime,
        querySize: typeof args[0] === "string" ? args[0].length : 0,
        resultSize: Array.isArray(result) ? result.length : 0,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      // Calculate execution time even for errors
      const executionTime = performance.now() - startTime;

      // Record performance metrics for failed queries
      recordPerformanceMetrics({
        executionTime,
        querySize: typeof args[0] === "string" ? args[0].length : 0,
        resultSize: 0,
        timestamp: new Date(),
      });

      throw error;
    }
  };

  return descriptor;
}

/**
 * Simple in-memory query cache
 */
export class QueryCache {
  private cache: Map<string, { result: unknown; timestamp: number }> =
    new Map();
  private readonly maxSize: number;
  private readonly ttl: number; // Time to live in milliseconds

  /**
   * Create a new query cache
   * @param maxSize Maximum number of entries in the cache
   * @param ttl Time to live in milliseconds
   */
  constructor(maxSize = 100, ttl = 60000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Generate a cache key for a query
   * @param query SQL query
   * @param params Query parameters
   * @returns Cache key
   */
  private generateKey(query: string, params?: unknown[]): string {
    const queryStr = query || "";
    return `${queryStr}:${params ? JSON.stringify(params) : ""}`;
  }

  /**
   * Get a result from the cache
   * @param query SQL query
   * @param params Query parameters
   * @returns Cached result or undefined if not found
   */
  get(query: string, params?: unknown[]): unknown | undefined {
    const key = this.generateKey(query, params);
    const cached = this.cache.get(key);

    if (!cached) {
      return undefined;
    }

    // Check if the cached result has expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return cached.result;
  }

  /**
   * Set a result in the cache
   * @param query SQL query
   * @param params Query parameters
   * @param result Query result
   */
  set(query: string, result: unknown, params?: unknown[]): void {
    // Don't cache undefined or null results
    if (result === undefined || result === null) {
      return;
    }

    const key = this.generateKey(query, params);

    // If the cache is full, remove the oldest entry
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of entries in the cache
   * @returns Number of entries
   */
  size(): number {
    return this.cache.size;
  }
}

// Create a singleton instance of the query cache
export const queryCache = new QueryCache();

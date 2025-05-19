/**
 * Prisma Accelerate configuration and utilities
 * Provides helpers for working with Prisma Accelerate and handling its limitations
 */

/**
 * Check if the current environment is using Prisma Accelerate
 * @returns boolean True if using Prisma Accelerate
 */
export function isPrismaAccelerate(): boolean {
  // Check both DATABASE_URL and RAW_DATABASE_URL for Prisma Accelerate
  return (
    process.env.DATABASE_URL?.includes("prisma.io") ||
    process.env.DATABASE_URL?.includes("prisma-data.io") ||
    process.env.RAW_DATABASE_URL?.includes("prisma.io") ||
    process.env.RAW_DATABASE_URL?.includes("prisma-data.io") ||
    false
  );
}

/**
 * Get the recommended transaction timeout for Prisma Accelerate
 * Prisma Accelerate has a 15-second limit for transactions
 * @returns number Transaction timeout in milliseconds
 */
export function getAccelerateTransactionTimeout(): number {
  return 10000; // Always use 10 seconds timeout regardless of client
}

/**
 * Get the recommended transaction max wait time for Prisma Accelerate
 * @returns number Max wait time in milliseconds
 */
export function getAccelerateMaxWait(): number {
  return 2000; // Always use 2 seconds max wait regardless of client
}

/**
 * Get Prisma Accelerate configuration options
 * @returns object Configuration options
 */
export function getAccelerateConfig(): {
  useTransactions: boolean;
  timeout: number;
  maxWait: number;
  isAccelerate: boolean;
} {
  const isAccelerate = isPrismaAccelerate();

  return {
    useTransactions: !isAccelerate, // Avoid transactions with Accelerate
    timeout: getAccelerateTransactionTimeout(),
    maxWait: getAccelerateMaxWait(),
    isAccelerate: isAccelerate, // Add isAccelerate flag for explicit checking
  };
}

/**
 * Log Prisma Accelerate status
 * @returns void
 */
export function logAccelerateStatus(): void {
  const isAccelerate = isPrismaAccelerate();
  console.log(
    `[PrismaAccelerate] Status: ${isAccelerate ? "Enabled" : "Disabled"}`
  );

  // Log configuration regardless of Accelerate status
  console.log(
    `[PrismaAccelerate] Transaction timeout: ${getAccelerateTransactionTimeout()}ms`
  );
  console.log(`[PrismaAccelerate] Max wait: ${getAccelerateMaxWait()}ms`);
  console.log(`[PrismaAccelerate] Using transactions: ${!isAccelerate}`);
}

/**
 * Initialize Prisma Accelerate configuration
 * Call this at application startup
 */
export function initializeAccelerate(): void {
  logAccelerateStatus();
}

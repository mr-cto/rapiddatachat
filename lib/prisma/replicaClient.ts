import { PrismaClient, Prisma } from "@prisma/client";
import {
  DatabaseConnectionManager,
  getConnectionManager,
} from "../database/connectionManager";

/**
 * Extended PrismaClient that routes heavy queries to a read replica
 * This helps prevent Prisma Accelerate timeouts for bulk operations
 */
export class ReplicaPrismaClient extends PrismaClient {
  private connectionManager: DatabaseConnectionManager;

  /**
   * Create a new instance of the ReplicaPrismaClient
   */
  constructor() {
    super({
      log: [
        { level: "query", emit: "event" },
        { level: "error", emit: "stdout" },
      ],
    });

    // Get the connection manager instance
    this.connectionManager = getConnectionManager();

    // Set up query logging in development
    if (process.env.NODE_ENV === "development") {
      // @ts-ignore - PrismaClient event types are not properly exposed
      this.$on("query", (e: any) => {
        if (
          e.query?.includes("USE_REPLICA") ||
          e.query?.includes("Using read replica")
        ) {
          console.log("Replica query:", e.query);
          console.log("Query params:", e.params);
          console.log("Duration:", e.duration, "ms");
        }
      });
    }
  }

  /**
   * Execute a query on the read replica using connection pooling
   * @param callback Function that executes the query
   * @returns Query result
   */
  async useReplica<T>(
    callback: (prisma: PrismaClient) => Promise<T>
  ): Promise<T> {
    // Get a client from the connection pool
    const replicaClient = this.connectionManager.getReplicaClient();

    try {
      // Execute the query on the replica
      const result = await callback(replicaClient);
      return result;
    } finally {
      // Release the client back to the pool
      this.connectionManager.releaseReplicaClient(replicaClient);
    }
  }

  /**
   * Find many records with automatic replica routing for large queries
   * @param model Model to query
   * @param args Query arguments
   * @returns Query result
   */
  async findManyWithReplica<T extends keyof PrismaClient>(
    model: T,
    args: any
  ): Promise<any> {
    // Check if this is a large query that should be routed to the replica
    const shouldUseReplica =
      // Large result sets
      (args.take && args.take > 1000) ||
      // Queries with specific comment markers
      (args.where && JSON.stringify(args.where).includes("USE_REPLICA")) ||
      // Queries with complex joins or aggregations
      args.include ||
      args.select;

    if (shouldUseReplica) {
      console.log(`Routing large ${String(model)} query to read replica`);

      return this.useReplica(async (replica) => {
        // Add a comment to track replica usage in logs
        const argsWithComment =
          process.env.NODE_ENV === "development"
            ? {
                ...args,
                comment: `Using read replica for ${String(model)} query`,
              }
            : args;

        // Execute the query on the replica
        // @ts-ignore - Dynamic model access
        return replica[model].findMany(argsWithComment);
      });
    }

    // Use default connection for normal queries
    // @ts-ignore - Dynamic model access
    return this[model].findMany(args);
  }

  /**
   * Create many records with automatic replica routing for bulk operations
   * @param model Model to create records for
   * @param args Create arguments
   * @returns Create result
   */
  async createManyWithReplica<T extends keyof PrismaClient>(
    model: T,
    args: any
  ): Promise<any> {
    // Always route bulk inserts to the replica to avoid Accelerate timeouts
    if (args.data && Array.isArray(args.data) && args.data.length > 100) {
      console.log(
        `Routing bulk insert of ${args.data.length} ${String(
          model
        )} records to direct connection`
      );

      return this.useReplica(async (replica) => {
        // Add a comment to track replica usage in logs
        const argsWithComment =
          process.env.NODE_ENV === "development"
            ? {
                ...args,
                comment: `Using direct connection for ${String(
                  model
                )} bulk insert`,
              }
            : args;

        // Execute the query on the replica
        // @ts-ignore - Dynamic model access
        return replica[model].createMany(argsWithComment);
      });
    }

    // Use default connection for smaller operations
    // @ts-ignore - Dynamic model access
    return this[model].createMany(args);
  }

  /**
   * Execute a transaction on the read replica
   * @param fn Transaction function
   * @param options Transaction options
   * @returns Transaction result
   */
  async replicaTransaction<T>(
    fn: (
      tx: Omit<
        PrismaClient,
        | "$connect"
        | "$disconnect"
        | "$on"
        | "$transaction"
        | "$use"
        | "$extends"
      >
    ) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    }
  ): Promise<T> {
    return this.useReplica(async (replica) => {
      return replica.$transaction(fn, options);
    });
  }
}

// Singleton instance
let prismaInstance: ReplicaPrismaClient | null = null;

/**
 * Get the ReplicaPrismaClient instance
 * @returns ReplicaPrismaClient instance
 */
export function getPrismaClient(): ReplicaPrismaClient {
  if (!prismaInstance) {
    // console.log("Initializing new ReplicaPrismaClient instance");
    try {
      prismaInstance = new ReplicaPrismaClient();
      // console.log("ReplicaPrismaClient initialized successfully");
    } catch (error) {
      console.error("Error initializing ReplicaPrismaClient:", error);
      throw error;
    }
  }
  return prismaInstance;
}

/**
 * Convenience function to execute a function with a replica client
 * @param callback Function to execute with the replica client
 * @returns Result of the callback function
 */
export async function withReplica<T>(
  callback: (client: PrismaClient) => Promise<T>
): Promise<T> {
  const prisma = getPrismaClient();
  return prisma.useReplica(callback);
}

import { PrismaClient } from "@prisma/client";

/**
 * Connection pool manager for Prisma clients
 * Implements a singleton pattern to manage database connections
 * and provide connection pooling for better performance
 */
export class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager;
  private primaryPool: PrismaClient[] = [];
  private replicaPool: PrismaClient[] = [];
  private maxPoolSize = 10;
  private minPoolSize = 2;
  private poolCreationTimestamps: Map<PrismaClient, number> = new Map();
  private maxConnectionAgeMs = 30 * 60 * 1000; // 30 minutes

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    console.log("Initializing DatabaseConnectionManager");
    this.initializePools();
  }

  /**
   * Get the singleton instance of the connection manager
   * @returns DatabaseConnectionManager instance
   */
  static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager();
    }
    return DatabaseConnectionManager.instance;
  }

  /**
   * Initialize connection pools with minimum number of connections
   */
  private initializePools(): void {
    // Initialize primary pool
    for (let i = 0; i < this.minPoolSize; i++) {
      const client = new PrismaClient();
      this.primaryPool.push(client);
      this.poolCreationTimestamps.set(client, Date.now());
    }

    // Initialize replica pool
    for (let i = 0; i < this.minPoolSize; i++) {
      const client = new PrismaClient({
        datasources: {
          db: {
            url: process.env.RAW_DATABASE_DATABASE_URL,
          },
        },
      });
      this.replicaPool.push(client);
      this.poolCreationTimestamps.set(client, Date.now());
    }

    console.log(
      `Initialized connection pools with ${this.minPoolSize} connections each`
    );
  }

  /**
   * Get a client from the primary pool or create a new one if needed
   * @returns PrismaClient instance
   */
  getPrimaryClient(): PrismaClient {
    if (this.primaryPool.length > 0) {
      const client = this.primaryPool.pop()!;

      // Check if the client is too old and should be refreshed
      const creationTime = this.poolCreationTimestamps.get(client) || 0;
      if (Date.now() - creationTime > this.maxConnectionAgeMs) {
        // Client is too old, disconnect and create a new one
        client
          .$disconnect()
          .catch((err) =>
            console.error("Error disconnecting old client:", err)
          );
        this.poolCreationTimestamps.delete(client);

        const newClient = new PrismaClient();
        this.poolCreationTimestamps.set(newClient, Date.now());
        return newClient;
      }

      return client;
    }

    // No clients available in the pool, create a new one
    const client = new PrismaClient();
    this.poolCreationTimestamps.set(client, Date.now());
    return client;
  }

  /**
   * Get a client from the replica pool or create a new one if needed
   * @returns PrismaClient instance configured to use the replica database
   */
  getReplicaClient(): PrismaClient {
    if (this.replicaPool.length > 0) {
      const client = this.replicaPool.pop()!;

      // Check if the client is too old and should be refreshed
      const creationTime = this.poolCreationTimestamps.get(client) || 0;
      if (Date.now() - creationTime > this.maxConnectionAgeMs) {
        // Client is too old, disconnect and create a new one
        client
          .$disconnect()
          .catch((err) =>
            console.error("Error disconnecting old client:", err)
          );
        this.poolCreationTimestamps.delete(client);

        const newClient = new PrismaClient({
          datasources: {
            db: {
              url: process.env.RAW_DATABASE_DATABASE_URL,
            },
          },
        });
        this.poolCreationTimestamps.set(newClient, Date.now());
        return newClient;
      }

      return client;
    }

    // No clients available in the pool, create a new one
    const client = new PrismaClient({
      datasources: {
        db: {
          url: process.env.RAW_DATABASE_DATABASE_URL,
        },
      },
    });
    this.poolCreationTimestamps.set(client, Date.now());
    return client;
  }

  /**
   * Release a client back to the primary pool
   * @param client PrismaClient instance to release
   */
  releasePrimaryClient(client: PrismaClient): void {
    // Check if the pool is already at max capacity
    if (this.primaryPool.length < this.maxPoolSize) {
      this.primaryPool.push(client);
    } else {
      // Pool is at capacity, disconnect the client
      client
        .$disconnect()
        .catch((err) => console.error("Error disconnecting client:", err));
      this.poolCreationTimestamps.delete(client);
    }
  }

  /**
   * Release a client back to the replica pool
   * @param client PrismaClient instance to release
   */
  releaseReplicaClient(client: PrismaClient): void {
    // Check if the pool is already at max capacity
    if (this.replicaPool.length < this.maxPoolSize) {
      this.replicaPool.push(client);
    } else {
      // Pool is at capacity, disconnect the client
      client
        .$disconnect()
        .catch((err) => console.error("Error disconnecting client:", err));
      this.poolCreationTimestamps.delete(client);
    }
  }

  /**
   * Get the current size of the primary pool
   * @returns Number of connections in the primary pool
   */
  getPrimaryPoolSize(): number {
    return this.primaryPool.length;
  }

  /**
   * Get the current size of the replica pool
   * @returns Number of connections in the replica pool
   */
  getReplicaPoolSize(): number {
    return this.replicaPool.length;
  }

  /**
   * Disconnect all clients and clear the pools
   * Used for graceful shutdown or testing
   */
  async closeAllConnections(): Promise<void> {
    // Disconnect all primary clients
    for (const client of this.primaryPool) {
      await client.$disconnect();
      this.poolCreationTimestamps.delete(client);
    }
    this.primaryPool = [];

    // Disconnect all replica clients
    for (const client of this.replicaPool) {
      await client.$disconnect();
      this.poolCreationTimestamps.delete(client);
    }
    this.replicaPool = [];

    console.log("Closed all database connections");
  }

  /**
   * Execute a function with a primary client and automatically release it
   * @param callback Function to execute with the client
   * @returns Result of the callback function
   */
  async withPrimaryClient<T>(
    callback: (client: PrismaClient) => Promise<T>
  ): Promise<T> {
    const client = this.getPrimaryClient();
    try {
      return await callback(client);
    } finally {
      this.releasePrimaryClient(client);
    }
  }

  /**
   * Execute a function with a replica client and automatically release it
   * @param callback Function to execute with the client
   * @returns Result of the callback function
   */
  async withReplicaClient<T>(
    callback: (client: PrismaClient) => Promise<T>
  ): Promise<T> {
    const client = this.getReplicaClient();
    try {
      return await callback(client);
    } finally {
      this.releaseReplicaClient(client);
    }
  }
}

// Export a convenience function to get the connection manager instance
export const getConnectionManager = (): DatabaseConnectionManager => {
  return DatabaseConnectionManager.getInstance();
};

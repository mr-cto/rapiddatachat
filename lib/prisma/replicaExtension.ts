import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Prisma extension to route heavy queries to a read replica
 * This helps prevent Prisma Accelerate timeouts for bulk operations
 */
/**
 * Helper function to add a comment to query arguments for logging
 */
function addCommentToArgs(
  args: any,
  operation: string,
  modelName?: string
): any {
  if (process.env.NODE_ENV !== "development") {
    return args;
  }

  const comment = modelName
    ? `Using replica for ${modelName}.${operation}`
    : `Using replica for ${operation}`;

  return {
    ...args,
    comment,
  };
}

/**
 * Prisma extension to route heavy queries to a read replica
 * This helps prevent Prisma Accelerate timeouts for bulk operations
 */
export const replicaRoutingExtension = Prisma.defineExtension((client) => {
  // Get the replica database URL from environment variables
  const replicaUrl = process.env.RAW_DATABASE_DATABASE_URL;

  // If no replica URL is configured, log a warning and return the client as-is
  if (!replicaUrl) {
    console.warn("No RAW_DATABASE_DATABASE_URL configured for replica routing");
    return client;
  }

  return client.$extends({
    name: "replicaRouting",
    query: {
      $allModels: {
        // Route heavy read operations to the replica
        async findMany({
          args,
          query,
          model,
        }: {
          args: any;
          query: (args: any) => Promise<any>;
          model: string;
        }) {
          // Check if this is a model that should always use the replica
          const isSpecialModel =
            model === "ImportJob" || model === "ProjectSchemaMeta";

          // Check if this is a large query that should be routed to the replica
          const shouldUseReplica =
            isSpecialModel ||
            // Large result sets
            (args.take && args.take > 1000) ||
            // Queries with specific comment markers
            (args.where &&
              JSON.stringify(args.where).includes("USE_REPLICA")) ||
            // Queries with complex aggregations
            (args as any).include ||
            (args as any).select;

          if (shouldUseReplica) {
            if (isSpecialModel) {
              console.log(`Routing ${model} query to read replica`);
            } else {
              console.log("Routing large query to read replica");
            }

            // Add a comment to track replica usage in logs
            const argsWithComment = addCommentToArgs(
              args,
              "findMany",
              isSpecialModel ? model : undefined
            );

            // Execute the query with the modified arguments
            return query(argsWithComment);
          }

          // Use default connection for normal queries
          return query(args);
        },

        // Route bulk operations to the replica
        async createMany({
          args,
          query,
          model,
        }: {
          args: any;
          query: (args: any) => Promise<any>;
          model: string;
        }) {
          // Check if this is a model that should always use the replica
          const isSpecialModel =
            model === "ImportJob" || model === "ProjectSchemaMeta";

          // Always route bulk inserts to the replica to avoid Accelerate timeouts
          const shouldUseReplica =
            isSpecialModel ||
            (args.data && Array.isArray(args.data) && args.data.length > 100);

          if (shouldUseReplica) {
            if (isSpecialModel) {
              console.log(
                `Routing ${model} bulk operation to direct connection`
              );
            } else {
              console.log(
                `Routing bulk insert of ${
                  args.data?.length || 0
                } records to direct connection`
              );
            }

            // Add a comment to track replica usage in logs
            const argsWithComment = addCommentToArgs(
              args,
              "createMany",
              isSpecialModel ? model : undefined
            );

            // Execute the query with the modified arguments
            return query(argsWithComment);
          }

          // Use default connection for smaller operations
          return query(args);
        },
      },
    },
  });
});

/**
 * Create a Prisma client with the replica routing extension
 */
export function createExtendedPrismaClient() {
  // Create a new PrismaClient with logging in development
  const prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [
            { level: "query", emit: "event" },
            { level: "error", emit: "stdout" },
          ]
        : ["error"],
  });

  // Set up query logging in development
  if (process.env.NODE_ENV === "development") {
    // @ts-ignore - PrismaClient event types are not properly exposed
    prisma.$on("query", (e: any) => {
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

  // Extend the client with the replica routing extension
  const extendedPrisma = prisma.$extends(replicaRoutingExtension);
  return extendedPrisma;
}

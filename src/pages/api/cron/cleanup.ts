import { NextApiRequest, NextApiResponse } from "next";
import { del, list } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";

// Create a local helper function to get the replica client
// This works around the TypeScript module resolution issue
function getReplicaClient() {
  // This class extends PrismaClient to route heavy queries to a read replica
  class ReplicaPrismaClient extends PrismaClient {
    constructor() {
      super({
        log: [
          { level: "query", emit: "event" },
          { level: "error", emit: "stdout" },
        ],
      });

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

    // Method to execute a query on the read replica
    async useReplica<T>(
      callback: (prisma: PrismaClient) => Promise<T>
    ): Promise<T> {
      // Create a new PrismaClient instance that uses the RAW_DATABASE_DATABASE_URL
      const replicaClient = new PrismaClient({
        datasources: {
          db: {
            url: process.env.RAW_DATABASE_DATABASE_URL,
          },
        },
      });

      try {
        // Execute the query on the replica
        const result = await callback(replicaClient);
        return result;
      } finally {
        // Disconnect from the replica
        await replicaClient.$disconnect();
      }
    }
  }

  // Singleton instance
  let prismaInstance: ReplicaPrismaClient | null = null;

  if (!prismaInstance) {
    prismaInstance = new ReplicaPrismaClient();
  }
  return prismaInstance;
}

/**
 * Vercel Cron job to clean up:
 * 1. Error blobs older than 2 hours
 * 2. Staging tables older than 30 days
 *
 * This should be configured to run hourly via Vercel Cron
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.authorization;

  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get the replica client using our local helper function
    const prisma = getReplicaClient();
    const results = {
      blobsDeleted: 0,
      tablesDropped: 0,
      errors: [] as string[],
    };

    // 1. Clean up error blobs older than 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Find error jobs with blobs that haven't been deleted
    // Use the read replica for this potentially heavy query
    const errorJobs = await prisma.useReplica(async (replicaClient) => {
      return replicaClient.$queryRaw<any[]>`
        SELECT id, blob_url, error_message, created_at
        FROM import_jobs
        WHERE status = 'ERROR'
        AND blob_deleted_at IS NULL
        AND created_at < ${twoHoursAgo}
      `;
    });

    console.log(`Found ${errorJobs.length} error jobs with blobs to clean up`);

    // Delete each blob
    for (const job of errorJobs) {
      try {
        // Delete the blob
        await del(job.blob_url);

        // Update the job to mark the blob as deleted
        await prisma.$executeRaw`
          UPDATE import_jobs
          SET blob_deleted_at = ${new Date()}
          WHERE id = ${job.id}
        `;

        results.blobsDeleted++;
        console.log(`Deleted blob for job ${job.id}`);
      } catch (error) {
        const errorMessage = `Error deleting blob for job ${job.id}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        console.error(errorMessage);
        results.errors.push(errorMessage);
      }
    }

    // 2. Clean up staging tables older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Find staging tables older than 30 days
    // We'll identify them by looking at the project_schema_meta table
    // Use the read replica for this potentially heavy query
    const oldStagingTables = await prisma.useReplica(async (replicaClient) => {
      return replicaClient.$queryRaw<any[]>`
        SELECT DISTINCT table_name
        FROM project_schema_meta
        WHERE created_at < ${thirtyDaysAgo}
        AND table_name LIKE 'staging_%'
      `;
    });

    console.log(`Found ${oldStagingTables.length} staging tables to clean up`);

    // Drop each staging table
    for (const table of oldStagingTables) {
      try {
        // Drop the table
        await prisma.$executeRaw`
          DROP TABLE IF EXISTS ${table.table_name}
        `;

        // Delete the schema metadata
        await prisma.$executeRaw`
          DELETE FROM project_schema_meta
          WHERE table_name = ${table.table_name}
        `;

        results.tablesDropped++;
        console.log(`Dropped staging table ${table.table_name}`);
      } catch (error) {
        const errorMessage = `Error dropping staging table ${
          table.table_name
        }: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMessage);
        results.errors.push(errorMessage);
      }
    }

    // Return the results
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error) {
    console.error("Error in cleanup cron job:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Configure the API route
export const config = {
  api: {
    bodyParser: true,
  },
};

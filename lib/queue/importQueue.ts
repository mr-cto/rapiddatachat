import { Queue, Worker, QueueEvents, Job } from "bullmq";
import { getPrismaClient } from "../prisma/replicaClient";

// Define the ImportJobStatus enum locally since it's not exported by Prisma client yet
export enum ImportJobStatus {
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  READY = "READY",
  ERROR = "ERROR",
}

// Environment variables
const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Queue configuration
const QUEUE_NAME = "smart-import";
const CONNECTION_CONFIG = {
  host: UPSTASH_REDIS_URL,
  token: UPSTASH_REDIS_TOKEN,
  // Upstash Redis uses a REST API, so we need to use the Redis client in a specific way
  enableOfflineQueue: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 100, 3000), // Exponential backoff
};

// Queue singleton
let importQueue: Queue | null = null;

/**
 * Get the import queue instance
 * @returns BullMQ Queue instance
 */
export function getImportQueue(): Queue {
  if (!importQueue) {
    importQueue = new Queue(QUEUE_NAME, {
      connection: CONNECTION_CONFIG,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false, // Keep failed jobs for debugging
        // @ts-ignore - timeout is valid but not in the type definition
        timeout: 300000, // 5 minutes (matching Vercel's maxDuration)
      },
    });
  }
  return importQueue;
}

/**
 * Job data interface for import jobs
 */
export interface ImportJobData {
  importJobId: string;
  projectId: string;
  userId: string;
  blobUrl: string;
  filename: string;
}

/**
 * Add an import job to the queue
 * @param jobData Import job data
 * @returns Job ID
 */
export async function queueImportJob(jobData: ImportJobData): Promise<string> {
  const queue = getImportQueue();

  // Add the job to the queue
  const job = await queue.add("process-import", jobData, {
    jobId: jobData.importJobId, // Use the importJobId as the job ID for traceability
  });

  console.log(`Import job queued: ${job.id}`);
  // job.id is guaranteed to exist since we provided jobId
  return job.id as string;
}

/**
 * Initialize the import worker
 * This should be called in a serverless function with maxDuration = 300s
 */
export async function initializeImportWorker(): Promise<Worker> {
  // Create a worker to process import jobs
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job<ImportJobData>) => {
      const { importJobId, projectId, userId, blobUrl, filename } = job.data;
      const prisma = getPrismaClient();

      try {
        // Update job status to PROCESSING
        await prisma.$executeRaw`
          UPDATE import_jobs 
          SET status = ${ImportJobStatus.PROCESSING}, 
              started_at = ${new Date()} 
          WHERE id = ${importJobId}
        `;

        // Log the start of processing
        console.log(
          `Processing import job ${importJobId} for file ${filename}`
        );

        // TODO: Implement the actual import logic here
        // This will be implemented in a separate file

        // For now, just update the job as completed
        await prisma.$executeRaw`
          UPDATE import_jobs
          SET status = ${ImportJobStatus.READY},
              completed_at = ${new Date()}
          WHERE id = ${importJobId}
        `;

        return { success: true, importJobId };
      } catch (error) {
        console.error(`Error processing import job ${importJobId}:`, error);

        // Update job status to ERROR
        await prisma.$executeRaw`
          UPDATE import_jobs 
          SET status = ${ImportJobStatus.ERROR}, 
              error_message = ${
                error instanceof Error ? error.message : String(error)
              }
          WHERE id = ${importJobId}
        `;

        throw error;
      }
    },
    {
      connection: CONNECTION_CONFIG,
      concurrency: 1, // Process one job at a time to avoid overloading the database
    }
  );

  // Set up event handlers
  worker.on("completed", (job: Job<ImportJobData>) => {
    console.log(`Import job ${job.id} completed successfully`);
  });

  worker.on("failed", (job: Job<ImportJobData> | undefined, error: Error) => {
    console.error(`Import job ${job?.id} failed:`, error);
  });

  console.log("Import worker initialized");
  return worker;
}

/**
 * Set up queue events for monitoring
 * @returns QueueEvents instance
 */
export function setupQueueEvents(): QueueEvents {
  const queueEvents = new QueueEvents(QUEUE_NAME, {
    connection: CONNECTION_CONFIG,
  });

  queueEvents.on("completed", ({ jobId }: { jobId: string }) => {
    console.log(`Job ${jobId} completed`);
  });

  queueEvents.on(
    "failed",
    ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
      console.error(`Job ${jobId} failed: ${failedReason}`);
    }
  );

  queueEvents.on(
    "progress",
    ({ jobId, data }: { jobId: string; data: any }) => {
      console.log(`Job ${jobId} progress: ${data}`);
    }
  );

  return queueEvents;
}

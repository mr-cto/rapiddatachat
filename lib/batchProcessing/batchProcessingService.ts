import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import {
  ErrorHandlingService,
  ErrorType,
} from "../errorHandling/errorHandlingService";
import * as os from "os";
import { EventEmitter } from "events";

/**
 * Batch job status
 */
export enum BatchJobStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  PAUSED = "paused",
}

/**
 * Batch partition status
 */
export enum BatchPartitionStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  PAUSED = "paused",
}

/**
 * Partition strategy
 */
export enum PartitionStrategy {
  SIZE_BASED = "size_based",
  COUNT_BASED = "count_based",
  TIME_BASED = "time_based",
  KEY_BASED = "key_based",
  HASH_BASED = "hash_based",
  RANGE_BASED = "range_based",
  ADAPTIVE = "adaptive",
}

/**
 * Performance metric type
 */
export enum MetricType {
  THROUGHPUT = "throughput",
  LATENCY = "latency",
  CPU_USAGE = "cpu_usage",
  MEMORY_USAGE = "memory_usage",
  DISK_USAGE = "disk_usage",
  NETWORK_USAGE = "network_usage",
  QUEUE_LENGTH = "queue_length",
  ERROR_RATE = "error_rate",
  PROCESSING_TIME = "processing_time",
  BATCH_SIZE = "batch_size",
  WORKER_UTILIZATION = "worker_utilization",
}

/**
 * Resource type
 */
export enum ResourceType {
  CPU = "cpu",
  MEMORY = "memory",
  DISK = "disk",
  NETWORK = "network",
  DATABASE = "database",
  CACHE = "cache",
  QUEUE = "queue",
  WORKER = "worker",
}

/**
 * Batch job configuration
 */
export interface BatchJobConfiguration {
  batchSize?: number;
  concurrency?: number;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  partitionStrategy?: PartitionStrategy;
  partitionSize?: number;
  partitionCount?: number;
  priorityLevel?: number;
  memoryLimit?: number;
  cpuLimit?: number;
}

/**
 * Batch job input
 */
export interface BatchJobInput {
  name: string;
  description?: string;
  configuration?: BatchJobConfiguration;
  projectId?: string;
  fileId?: string;
}

/**
 * Worker class for processing partitions
 */
class Worker extends EventEmitter {
  private id: string;
  private partition: any;
  private configuration: BatchJobConfiguration;
  private _status: string = "idle";
  private processingInterval: NodeJS.Timeout | null = null;

  /**
   * Constructor
   * @param id Worker ID
   * @param partition Batch partition
   * @param configuration Batch job configuration
   */
  constructor(
    id: string,
    partition: any,
    configuration: BatchJobConfiguration
  ) {
    super();
    this.id = id;
    this.partition = partition;
    this.configuration = configuration;
  }

  /**
   * Get worker status
   */
  get status(): string {
    return this._status;
  }

  /**
   * Start worker
   */
  start(): void {
    this._status = "running";

    // Simulate processing
    let processedRecords = 0;
    let failedRecords = 0;
    const totalRecords = 100; // Simulated total records

    this.processingInterval = setInterval(() => {
      // Simulate processing a batch
      const batchSize = this.configuration.batchSize || 10;
      const remainingRecords = totalRecords - processedRecords - failedRecords;
      const recordsToProcess = Math.min(batchSize, remainingRecords);

      if (recordsToProcess <= 0) {
        // Processing complete
        this.terminate();
        this.emit("complete");
        return;
      }

      // Simulate some failures
      const failureRate = 0.05; // 5% failure rate
      const newFailedRecords = Math.floor(recordsToProcess * failureRate);
      const newProcessedRecords = recordsToProcess - newFailedRecords;

      processedRecords += newProcessedRecords;
      failedRecords += newFailedRecords;

      // Emit progress
      this.emit("progress", {
        processedRecords,
        failedRecords,
        totalRecords,
      });
    }, 1000); // Process every second
  }

  /**
   * Pause worker
   */
  pause(): void {
    if (this._status === "running" && this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      this._status = "paused";
    }
  }

  /**
   * Resume worker
   */
  resume(): void {
    if (this._status === "paused") {
      this.start();
    }
  }

  /**
   * Terminate worker
   */
  terminate(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this._status = "terminated";
  }
}

/**
 * Batch processing service
 */
export class BatchProcessingService {
  private prisma: PrismaClient;
  private errorHandlingService: ErrorHandlingService;
  private workers: Map<string, Worker> = new Map();
  private defaultConfiguration: BatchJobConfiguration = {
    batchSize: 1000,
    concurrency: Math.max(1, Math.floor(os.cpus().length / 2)),
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 30000,
    partitionStrategy: PartitionStrategy.SIZE_BASED,
    partitionSize: 10000,
    partitionCount: 10,
    priorityLevel: 1,
    memoryLimit: 1024 * 1024 * 1024, // 1GB
    cpuLimit: 0.5, // 50% of a CPU core
  };

  /**
   * Constructor
   */
  constructor() {
    this.prisma = new PrismaClient();
    this.errorHandlingService = new ErrorHandlingService();
  }

  /**
   * Create a batch job
   * @param input Batch job input
   * @returns Promise<any> Created batch job
   */
  async createJob(input: BatchJobInput): Promise<any> {
    try {
      // Generate ID
      const id = `job_${uuidv4()}`;

      // Merge with default configuration
      const configuration = {
        ...this.defaultConfiguration,
        ...input.configuration,
      };

      // Create batch job
      const job = await this.prisma.batchJob.create({
        data: {
          id,
          name: input.name,
          description: input.description,
          status: BatchJobStatus.PENDING,
          configuration: JSON.stringify(configuration),
          projectId: input.projectId,
          fileId: input.fileId,
        },
      });

      return job;
    } catch (error) {
      console.error("Error creating batch job:", error);
      await this.errorHandlingService.logError({
        type: ErrorType.SYSTEM_ERROR,
        message: `Error creating batch job: ${
          error instanceof Error ? error.message : String(error)
        }`,
        context: {
          input,
        },
        severity: "error",
      });
      throw error;
    }
  }

  /**
   * Get a batch job
   * @param id Batch job ID
   * @returns Promise<any> Batch job
   */
  async getJob(id: string): Promise<any> {
    try {
      // Get batch job
      const job = await this.prisma.batchJob.findUnique({
        where: {
          id,
        },
        include: {
          partitions: true,
        },
      });

      if (!job) {
        throw new Error(`Batch job ${id} not found`);
      }

      return job;
    } catch (error) {
      console.error(`Error getting batch job ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get batch jobs
   * @param projectId Optional project ID
   * @param status Optional status
   * @param limit Optional limit
   * @param offset Optional offset
   * @returns Promise<any[]> Batch jobs
   */
  async getJobs(
    projectId?: string,
    status?: BatchJobStatus,
    limit?: number,
    offset?: number
  ): Promise<any[]> {
    try {
      // Build filter
      const filter: any = {};

      if (projectId) {
        filter.projectId = projectId;
      }

      if (status) {
        filter.status = status;
      }

      // Get batch jobs
      const jobs = await this.prisma.batchJob.findMany({
        where: filter,
        include: {
          partitions: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
      });

      return jobs;
    } catch (error) {
      console.error("Error getting batch jobs:", error);
      throw error;
    }
  }

  /**
   * Start a batch job
   * @param id Batch job ID
   * @returns Promise<any> Updated batch job
   */
  async startJob(id: string): Promise<any> {
    try {
      // Get batch job
      const job = await this.getJob(id);

      // Check if job can be started
      if (
        job.status !== BatchJobStatus.PENDING &&
        job.status !== BatchJobStatus.PAUSED
      ) {
        throw new Error(
          `Cannot start batch job ${id} with status ${job.status}`
        );
      }

      // Parse configuration
      const configuration = JSON.parse(job.configuration);

      // Create partitions if they don't exist
      if (job.partitions.length === 0) {
        await this.createPartitions(job, configuration);
      }

      // Update job status
      const updatedJob = await this.prisma.batchJob.update({
        where: {
          id,
        },
        data: {
          status: BatchJobStatus.RUNNING,
          startedAt: new Date(),
        },
        include: {
          partitions: true,
        },
      });

      // Start processing partitions
      this.processPartitions(updatedJob, configuration);

      return updatedJob;
    } catch (error) {
      console.error(`Error starting batch job ${id}:`, error);

      // Update job status to failed
      await this.prisma.batchJob.update({
        where: {
          id,
        },
        data: {
          status: BatchJobStatus.FAILED,
        },
      });

      // Log error
      await this.errorHandlingService.logError({
        type: ErrorType.SYSTEM_ERROR,
        message: `Error starting batch job ${id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        context: {
          jobId: id,
        },
        severity: "error",
      });

      throw error;
    }
  }

  /**
   * Stop a batch job
   * @param id Batch job ID
   * @returns Promise<any> Updated batch job
   */
  async stopJob(id: string): Promise<any> {
    try {
      // Get batch job
      const job = await this.getJob(id);

      // Check if job can be stopped
      if (
        job.status !== BatchJobStatus.RUNNING &&
        job.status !== BatchJobStatus.PAUSED
      ) {
        throw new Error(
          `Cannot stop batch job ${id} with status ${job.status}`
        );
      }

      // Stop workers
      for (const partition of job.partitions) {
        const workerId = `worker_${partition.id}`;
        const worker = this.workers.get(workerId);
        if (worker) {
          worker.terminate();
          this.workers.delete(workerId);
        }
      }

      // Update job status
      const updatedJob = await this.prisma.batchJob.update({
        where: {
          id,
        },
        data: {
          status: BatchJobStatus.CANCELLED,
        },
        include: {
          partitions: true,
        },
      });

      // Update partition status
      await this.prisma.batchPartition.updateMany({
        where: {
          jobId: id,
          status: {
            in: [
              BatchPartitionStatus.PENDING,
              BatchPartitionStatus.RUNNING,
              BatchPartitionStatus.PAUSED,
            ],
          },
        },
        data: {
          status: BatchPartitionStatus.CANCELLED,
        },
      });

      return updatedJob;
    } catch (error) {
      console.error(`Error stopping batch job ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a batch job
   * @param id Batch job ID
   * @returns Promise<any> Deleted batch job
   */
  async deleteJob(id: string): Promise<any> {
    try {
      // Get batch job
      const job = await this.getJob(id);

      // Stop workers
      for (const partition of job.partitions) {
        const workerId = `worker_${partition.id}`;
        const worker = this.workers.get(workerId);
        if (worker) {
          worker.terminate();
          this.workers.delete(workerId);
        }
      }

      // Delete batch job
      const deletedJob = await this.prisma.batchJob.delete({
        where: {
          id,
        },
      });

      return deletedJob;
    } catch (error) {
      console.error(`Error deleting batch job ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create partitions for a batch job
   * @param job Batch job
   * @param configuration Batch job configuration
   * @returns Promise<any[]> Created partitions
   */
  private async createPartitions(
    job: any,
    configuration: BatchJobConfiguration
  ): Promise<any[]> {
    try {
      // Determine partition count
      const partitionCount = configuration.partitionCount || 10;

      // Create partitions
      const partitions = [];
      for (let i = 0; i < partitionCount; i++) {
        const partitionId = `partition_${uuidv4()}`;
        const partition = await this.prisma.batchPartition.create({
          data: {
            id: partitionId,
            jobId: job.id,
            partitionNumber: i + 1,
            status: BatchPartitionStatus.PENDING,
            partitionData: JSON.stringify({
              partitionIndex: i,
              partitionCount,
              partitionStrategy: configuration.partitionStrategy,
              partitionSize: configuration.partitionSize,
            }),
          },
        });
        partitions.push(partition);
      }

      return partitions;
    } catch (error) {
      console.error(
        `Error creating partitions for batch job ${job.id}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Process partitions for a batch job
   * @param job Batch job
   * @param configuration Batch job configuration
   */
  private processPartitions(
    job: any,
    configuration: BatchJobConfiguration
  ): void {
    try {
      // Get pending partitions
      const pendingPartitions = job.partitions.filter(
        (partition: any) => partition.status === BatchPartitionStatus.PENDING
      );

      // Determine concurrency
      const concurrency = configuration.concurrency || 1;

      // Process partitions concurrently
      for (
        let i = 0;
        i < Math.min(concurrency, pendingPartitions.length);
        i++
      ) {
        const partition = pendingPartitions[i];
        this.processPartition(job, partition, configuration);
      }
    } catch (error) {
      console.error(
        `Error processing partitions for batch job ${job.id}:`,
        error
      );

      // Update job status to failed
      this.prisma.batchJob
        .update({
          where: {
            id: job.id,
          },
          data: {
            status: BatchJobStatus.FAILED,
          },
        })
        .catch((err) => {
          console.error(`Error updating batch job ${job.id} status:`, err);
        });

      // Log error
      this.errorHandlingService
        .logError({
          type: ErrorType.SYSTEM_ERROR,
          message: `Error processing partitions for batch job ${job.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          context: {
            jobId: job.id,
          },
          severity: "error",
        })
        .catch((err) => {
          console.error(`Error logging error for batch job ${job.id}:`, err);
        });
    }
  }

  /**
   * Process a partition
   * @param job Batch job
   * @param partition Batch partition
   * @param configuration Batch job configuration
   */
  private async processPartition(
    job: any,
    partition: any,
    configuration: BatchJobConfiguration
  ): Promise<void> {
    try {
      // Update partition status
      await this.prisma.batchPartition.update({
        where: {
          id: partition.id,
        },
        data: {
          status: BatchPartitionStatus.RUNNING,
          startedAt: new Date(),
        },
      });

      // Create a worker for the partition
      const workerId = `worker_${partition.id}`;
      const worker = new Worker(workerId, partition, configuration);
      this.workers.set(workerId, worker);

      // Start the worker
      worker.start();

      // Monitor worker progress
      worker.on("progress", async (progress: any) => {
        // Update partition progress
        await this.prisma.batchPartition.update({
          where: {
            id: partition.id,
          },
          data: {
            processedRecords: progress.processedRecords,
            failedRecords: progress.failedRecords,
            totalRecords: progress.totalRecords,
          },
        });

        // Update job progress
        await this.updateJobProgress(job.id);
      });

      // Handle worker completion
      worker.on("complete", async () => {
        // Update partition status
        await this.prisma.batchPartition.update({
          where: {
            id: partition.id,
          },
          data: {
            status: BatchPartitionStatus.COMPLETED,
            completedAt: new Date(),
          },
        });

        // Remove worker
        this.workers.delete(workerId);

        // Update job progress
        await this.updateJobProgress(job.id);

        // Process next partition
        await this.processNextPartition(job, configuration);
      });

      // Handle worker failure
      worker.on("error", async (error: any) => {
        console.error(`Error processing partition ${partition.id}:`, error);

        // Update partition status
        await this.prisma.batchPartition.update({
          where: {
            id: partition.id,
          },
          data: {
            status: BatchPartitionStatus.FAILED,
          },
        });

        // Remove worker
        this.workers.delete(workerId);

        // Log error
        await this.errorHandlingService.logError({
          type: ErrorType.SYSTEM_ERROR,
          message: `Error processing partition ${partition.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          context: {
            jobId: job.id,
            partitionId: partition.id,
          },
          severity: "error",
        });

        // Update job progress
        await this.updateJobProgress(job.id);

        // Process next partition
        await this.processNextPartition(job, configuration);
      });
    } catch (error) {
      console.error(`Error processing partition ${partition.id}:`, error);

      // Update partition status
      await this.prisma.batchPartition.update({
        where: {
          id: partition.id,
        },
        data: {
          status: BatchPartitionStatus.FAILED,
        },
      });

      // Log error
      await this.errorHandlingService.logError({
        type: ErrorType.SYSTEM_ERROR,
        message: `Error processing partition ${partition.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        context: {
          jobId: job.id,
          partitionId: partition.id,
        },
        severity: "error",
      });

      // Update job progress
      await this.updateJobProgress(job.id);

      // Process next partition
      await this.processNextPartition(job, configuration);
    }
  }

  /**
   * Process the next partition
   * @param job Batch job
   * @param configuration Batch job configuration
   */
  private async processNextPartition(
    job: any,
    configuration: BatchJobConfiguration
  ): Promise<void> {
    try {
      // Get job with updated partitions
      const updatedJob = await this.getJob(job.id);

      // Check if job is still running
      if (updatedJob.status !== BatchJobStatus.RUNNING) {
        return;
      }

      // Get pending partitions
      const pendingPartitions = updatedJob.partitions.filter(
        (partition: any) => partition.status === BatchPartitionStatus.PENDING
      );

      // Check if there are pending partitions
      if (pendingPartitions.length === 0) {
        // Check if all partitions are completed
        const allCompleted = updatedJob.partitions.every(
          (partition: any) =>
            partition.status === BatchPartitionStatus.COMPLETED
        );

        // Update job status
        await this.prisma.batchJob.update({
          where: {
            id: job.id,
          },
          data: {
            status: allCompleted
              ? BatchJobStatus.COMPLETED
              : BatchJobStatus.FAILED,
            completedAt: new Date(),
          },
        });

        return;
      }

      // Get running partitions
      const runningPartitions = updatedJob.partitions.filter(
        (partition: any) => partition.status === BatchPartitionStatus.RUNNING
      );

      // Check if we can start more partitions
      const concurrency = configuration.concurrency || 1;
      if (runningPartitions.length < concurrency) {
        // Start the next partition
        const nextPartition = pendingPartitions[0];
        await this.processPartition(updatedJob, nextPartition, configuration);
      }
    } catch (error) {
      console.error(
        `Error processing next partition for batch job ${job.id}:`,
        error
      );

      // Log error
      await this.errorHandlingService.logError({
        type: ErrorType.SYSTEM_ERROR,
        message: `Error processing next partition for batch job ${job.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        context: {
          jobId: job.id,
        },
        severity: "error",
      });
    }
  }

  /**
   * Update job progress
   * @param jobId Batch job ID
   */
  private async updateJobProgress(jobId: string): Promise<void> {
    try {
      // Get job with partitions
      const job = await this.prisma.batchJob.findUnique({
        where: {
          id: jobId,
        },
        include: {
          partitions: true,
        },
      });

      if (!job) {
        return;
      }

      // Calculate progress
      let totalRecords = 0;
      let processedRecords = 0;
      let failedRecords = 0;

      for (const partition of job.partitions) {
        totalRecords += partition.totalRecords || 0;
        processedRecords += partition.processedRecords || 0;
        failedRecords += partition.failedRecords || 0;
      }

      // Update job progress
      await this.prisma.batchJob.update({
        where: {
          id: jobId,
        },
        data: {
          totalRecords,
          processedRecords,
          failedRecords,
        },
      });

      // Record performance metrics
      await this.recordPerformanceMetrics(job);
    } catch (error) {
      console.error(
        `Error updating job progress for batch job ${jobId}:`,
        error
      );
    }
  }

  /**
   * Record performance metrics
   * @param job Batch job
   */
  private async recordPerformanceMetrics(job: any): Promise<void> {
    try {
      // Calculate metrics
      const now = new Date();
      const startTime = job.startedAt ? new Date(job.startedAt) : now;
      const elapsedTime = (now.getTime() - startTime.getTime()) / 1000; // in seconds
      const processedRecords = job.processedRecords || 0;
      const throughput = elapsedTime > 0 ? processedRecords / elapsedTime : 0;

      // Record throughput metric
      await this.prisma.performanceMetric.create({
        data: {
          id: `metric_${uuidv4()}`,
          component: "batch_processor",
          metricName: MetricType.THROUGHPUT,
          metricValue: throughput,
          jobId: job.id,
          context: JSON.stringify({
            elapsedTime,
            processedRecords,
          }),
        },
      });

      // Record resource usage metrics
      const cpuUsage = process.cpuUsage();
      const memoryUsage = process.memoryUsage();

      await this.prisma.resourceUsage.create({
        data: {
          id: `resource_${uuidv4()}`,
          resourceType: ResourceType.CPU,
          resourceName: "process",
          usageValue: (cpuUsage.user + cpuUsage.system) / 1000000, // in seconds
          jobId: job.id,
          context: JSON.stringify(cpuUsage),
        },
      });

      await this.prisma.resourceUsage.create({
        data: {
          id: `resource_${uuidv4()}`,
          resourceType: ResourceType.MEMORY,
          resourceName: "process",
          usageValue: memoryUsage.rss / 1024 / 1024, // in MB
          jobId: job.id,
          context: JSON.stringify(memoryUsage),
        },
      });
    } catch (error) {
      console.error(
        `Error recording performance metrics for batch job ${job.id}:`,
        error
      );
    }
  }
}

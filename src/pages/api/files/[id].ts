import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { dropMergedColumnView } from "../../../../lib/columnMergeService";
import { authOptions } from "../../../../lib/authOptions";
import { getPrismaClient } from "../../../../lib/prisma/replicaClient";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Get the file ID from the URL
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid file ID" });
  }

  // Check authentication
  const session = await getServerSession(req, res, authOptions);

  // In development, allow requests without authentication for testing
  const isDevelopment = process.env.NODE_ENV === "development";
  if ((!session || !session.user) && !isDevelopment) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Use a default user email for development
  const userEmail =
    session?.user?.email || (isDevelopment ? "dev@example.com" : "");

  // Get Prisma client
  const prisma = getPrismaClient();

  // Handle different HTTP methods
  switch (req.method) {
    case "GET":
      return handleGetRequest(req, res, id, userEmail, prisma);
    case "DELETE":
      return handleDeleteRequest(req, res, id, userEmail, prisma);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

/**
 * Handle GET request to fetch a specific file
 */
async function handleGetRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  fileId: string,
  userEmail: string,
  prisma: PrismaClient
) {
  try {
    // Get the file
    const file = await (prisma as any).useReplica(
      async (replicaClient: PrismaClient) => {
        return await replicaClient.file.findFirst({
          where: {
            id: fileId,
            userId: userEmail,
          },
          include: {
            _count: {
              select: {
                fileErrors: true,
              },
            },
          },
        });
      }
    );

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    return res.status(200).json({ file });
  } catch (error) {
    console.error("Error fetching file:", error);
    return res.status(500).json({
      error: "Failed to fetch file",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle DELETE request to delete a file
 */
async function handleDeleteRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  fileId: string,
  userEmail: string,
  prisma: PrismaClient
) {
  try {
    // Get the file to check if it exists and belongs to the user
    const file = await (prisma as any).useReplica(
      async (replicaClient: PrismaClient) => {
        return await replicaClient.file.findFirst({
          where: {
            id: fileId,
            userId: userEmail,
          },
        });
      }
    );

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Delete the file data using batched deletion to prevent timeouts
    console.log(`Starting batched deletion of file data for file ${fileId}`);

    // First, count how many records we need to delete
    const countResult = await (prisma as any).useReplica(
      async (replicaClient: PrismaClient) => {
        return await replicaClient.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*) as count FROM file_data WHERE file_id = ${fileId}
      `;
      }
    );

    const totalRecords = parseInt(countResult[0].count.toString());
    console.log(`Found ${totalRecords} records to delete`);

    if (totalRecords > 0) {
      // Use batched deletion with direct SQL for better performance
      const batchSize = 5000;
      let deletedCount = 0;

      while (deletedCount < totalRecords) {
        // Use raw SQL with the read replica connection for better performance
        await (prisma as any).useReplica(
          async (replicaClient: PrismaClient) => {
            return await replicaClient.$executeRaw`
            DELETE FROM file_data
            WHERE id IN (
              SELECT id FROM file_data
              WHERE file_id = ${fileId}
              LIMIT ${batchSize}
            )
          `;
          }
        );

        deletedCount += batchSize;
        console.log(
          `Deleted ${Math.min(
            deletedCount,
            totalRecords
          )} of ${totalRecords} records`
        );
      }
    }

    console.log(`Completed deletion of file data for file ${fileId}`);

    // Delete file errors
    await (prisma as any).useReplica(async (replicaClient: PrismaClient) => {
      return await replicaClient.fileError.deleteMany({
        where: {
          fileId,
        },
      });
    });

    // Delete dead letter queue items
    await (prisma as any).useReplica(async (replicaClient: PrismaClient) => {
      return await replicaClient.deadLetterQueueItem.deleteMany({
        where: {
          fileId,
        },
      });
    });

    // Delete sources
    await (prisma as any).useReplica(async (replicaClient: PrismaClient) => {
      return await replicaClient.source.deleteMany({
        where: {
          fileId,
        },
      });
    });

    // Delete column mappings (this was missing and causing the foreign key constraint error)
    await (prisma as any).useReplica(async (replicaClient: PrismaClient) => {
      return await replicaClient.columnMapping.deleteMany({
        where: {
          fileId,
        },
      });
    });

    // Get and delete column merges
    // Get column merges
    const columnMerges = await (prisma as any).useReplica(
      async (replicaClient: PrismaClient) => {
        return await (replicaClient as any).columnMerge.findMany({
          where: {
            fileId,
          },
        });
      }
    );

    // Drop PostgreSQL views for each column merge
    for (const merge of columnMerges) {
      try {
        await dropMergedColumnView({
          id: merge.id,
          userId: merge.userId,
          fileId: merge.fileId,
          mergeName: merge.mergeName,
          columnList: merge.columnList,
          delimiter: merge.delimiter,
        });
      } catch (viewError) {
        console.error(
          `Error dropping view for column merge ${merge.id}:`,
          viewError
        );
        // Continue with deletion even if view dropping fails
      }
    }

    // Delete column merges
    await (prisma as any).useReplica(async (replicaClient: PrismaClient) => {
      return await (replicaClient as any).columnMerge.deleteMany({
        where: {
          fileId,
        },
      });
    });

    // Delete the file record
    await (prisma as any).useReplica(async (replicaClient: PrismaClient) => {
      return await replicaClient.file.delete({
        where: {
          id: fileId,
        },
      });
    });

    // Delete the physical file if it exists
    if (file.filepath) {
      const filePath = path.join(process.cwd(), file.filepath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    return res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting file:", error);
    return res.status(500).json({
      error: "Failed to delete file",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { z } from "zod";
import { getPrismaClient } from "../../../../lib/prisma/replicaClient";
import { queueImportJob } from "../../../../lib/queue/importQueue";
import { randomUUID } from "crypto";

// Validation schema for the request body
const ImportQueueSchema = z.object({
  projectId: z.string().uuid(),
  blobUrl: z.string().url(),
  filename: z.string().min(1),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get the user session
    const session = await getServerSession(req, res, authOptions);

    // Check if the user is authenticated
    if (!session || !session.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = session.user.id;

    // Validate the request body
    const validationResult = ImportQueueSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: validationResult.error.format(),
      });
    }

    const { projectId, blobUrl, filename } = validationResult.data;

    // Get the Prisma client
    const prisma = getPrismaClient();

    // Check if the project exists and belongs to the user
    const project = await prisma.$queryRaw<any[]>`
      SELECT * FROM projects 
      WHERE id = ${projectId} 
      LIMIT 1
    `;

    if (!project || project.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Create a new import job
    const importJobId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO import_jobs (
        id, project_id, user_id, filename, blob_url, 
        status, rows_processed, created_at, updated_at
      ) VALUES (
        ${importJobId}, ${projectId}, ${userId}, ${filename}, ${blobUrl}, 
        'QUEUED', 0, ${new Date()}, ${new Date()}
      )
    `;

    // Queue the import job
    await queueImportJob({
      importJobId,
      projectId,
      userId,
      blobUrl,
      filename,
    });

    // Return the import job ID
    return res.status(200).json({
      success: true,
      importJobId,
      message: "Import job queued successfully",
    });
  } catch (error) {
    console.error("Error queueing import job:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Configure the API route to use the maximum duration
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
    responseLimit: false,
  },
};

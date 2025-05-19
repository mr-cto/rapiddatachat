import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { getPrismaClient } from "../../../../lib/prisma/replicaClient";


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
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

  try {
    // Get Prisma client
    const prisma = getPrismaClient();

    // Get the projectId from the query
    const { projectId } = req.query;

    // Prepare the response object
    const result: any = {
      projectId,
      userEmail,
      checks: {},
    };

    // Check 1: Get all files for the user
    const allUserFiles = await prisma.file.findMany({
      where: {
        userId: userEmail,
      },
      select: {
        id: true,
        filename: true,
        status: true,
        projectId: true,
      },
    });

    result.checks.allUserFiles = {
      count: allUserFiles.length,
      files: allUserFiles,
    };

    // Check 2: Get files with the specified projectId
    if (projectId) {
      const filesWithProjectId = await prisma.file.findMany({
        where: {
          userId: userEmail,
          projectId: projectId as string,
        },
        select: {
          id: true,
          filename: true,
          status: true,
          projectId: true,
        },
      });

      result.checks.filesWithProjectId = {
        count: filesWithProjectId.length,
        files: filesWithProjectId,
      };
    }

    // Check 3: Get files in the project_files join table
    if (projectId) {
      const filesInJoinTable = await prisma.$queryRaw`
        SELECT f.id, f.filename, f.status, f.project_id as "projectId"
        FROM files f
        JOIN project_files pf ON f.id = pf.file_id
        WHERE f.user_id = ${userEmail}
        AND pf.project_id = ${projectId as string}
      `;

      result.checks.filesInJoinTable = {
        count: Array.isArray(filesInJoinTable) ? filesInJoinTable.length : 0,
        files: filesInJoinTable,
      };
    }

    // Check 4: Get the project itself
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: {
          id: projectId as string,
        },
        select: {
          id: true,
          name: true,
          userId: true,
        },
      });

      result.checks.project = project;
    }

    // Return the results
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error checking files in database:", error);
    return res.status(500).json({
      error: "Failed to check files in database",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { PrismaClient } from "@prisma/client";

// Initialize Prisma client (singleton)
let prismaInstance: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

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

    // Find files with no projectId
    const filesWithoutProject = await prisma.file.findMany({
      where: {
        userId: userEmail,
        projectId: null,
      },
      include: {
        _count: {
          select: {
            fileErrors: true,
          },
        },
      },
    });

    console.log(`Found ${filesWithoutProject.length} files with no projectId`);

    // Find files that are in project_files but don't have projectId set
    const filesInJoinTable = await prisma.$queryRaw`
      SELECT f.id, f.filename, f.status, pf.project_id
      FROM files f
      JOIN project_files pf ON f.id = pf.file_id
      WHERE f.user_id = ${userEmail}
      AND f.project_id IS NULL
    `;

    console.log(
      `Found ${
        Array.isArray(filesInJoinTable) ? filesInJoinTable.length : 0
      } files in join table but with no projectId`
    );

    // Return the results
    return res.status(200).json({
      filesWithoutProject,
      filesInJoinTable,
      counts: {
        filesWithoutProject: filesWithoutProject.length,
        filesInJoinTable: Array.isArray(filesInJoinTable)
          ? filesInJoinTable.length
          : 0,
      },
    });
  } catch (error) {
    console.error("Error finding files without project:", error);
    return res.status(500).json({
      error: "Failed to find files without project",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

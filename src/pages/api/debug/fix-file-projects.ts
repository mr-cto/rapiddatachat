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
  // Only allow POST requests
  if (req.method !== "POST") {
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

    // Get the projectId from the request body
    const { projectId, updateAllFiles } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    const updateResults = [];

    // Find files that are in project_files but don't have projectId set
    const filesInJoinTable = await prisma.$queryRaw`
      SELECT f.id, f.filename, f.status, pf.project_id
      FROM files f
      JOIN project_files pf ON f.id = pf.file_id
      WHERE f.user_id = ${userEmail}
      AND f.project_id IS NULL
      AND pf.project_id = ${projectId}
    `;

    console.log(
      `Found ${
        Array.isArray(filesInJoinTable) ? filesInJoinTable.length : 0
      } files in join table but with no projectId`
    );

    // Update files from join table
    if (Array.isArray(filesInJoinTable)) {
      for (const file of filesInJoinTable) {
        try {
          await prisma.file.update({
            where: { id: file.id },
            data: { projectId },
          });

          updateResults.push({
            id: file.id,
            filename: file.filename,
            status: "updated",
            source: "join_table",
          });

          console.log(
            `Updated file ${file.id} (${file.filename}) with projectId ${projectId} (from join table)`
          );
        } catch (updateError) {
          console.error(`Error updating file ${file.id}:`, updateError);

          updateResults.push({
            id: file.id,
            filename: file.filename,
            status: "error",
            source: "join_table",
            error:
              updateError instanceof Error
                ? updateError.message
                : "Unknown error",
          });
        }
      }
    }

    // If updateAllFiles is true, also update files with no project association at all
    if (updateAllFiles) {
      // Find files with no projectId
      const filesWithoutProject = await prisma.file.findMany({
        where: {
          userId: userEmail,
          projectId: null,
        },
        select: {
          id: true,
          filename: true,
          status: true,
        },
      });

      console.log(
        `Found ${filesWithoutProject.length} files with no projectId to update`
      );

      // Update each file to set the projectId
      for (const file of filesWithoutProject) {
        try {
          // Update the file
          await prisma.file.update({
            where: { id: file.id },
            data: { projectId },
          });

          // Also add to the project_files join table
          await prisma.$executeRaw`
            INSERT INTO project_files (project_id, file_id)
            VALUES (${projectId}, ${file.id})
            ON CONFLICT (project_id, file_id) DO NOTHING
          `;

          updateResults.push({
            id: file.id,
            filename: file.filename,
            status: "updated",
            source: "orphaned_file",
          });

          console.log(
            `Updated orphaned file ${file.id} (${file.filename}) with projectId ${projectId}`
          );
        } catch (updateError) {
          console.error(
            `Error updating orphaned file ${file.id}:`,
            updateError
          );

          updateResults.push({
            id: file.id,
            filename: file.filename,
            status: "error",
            source: "orphaned_file",
            error:
              updateError instanceof Error
                ? updateError.message
                : "Unknown error",
          });
        }
      }
    }

    // Return the results
    return res.status(200).json({
      success: true,
      filesUpdated: updateResults.length,
      updateResults,
    });
  } catch (error) {
    console.error("Error fixing file projects:", error);
    return res.status(500).json({
      error: "Failed to fix file projects",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

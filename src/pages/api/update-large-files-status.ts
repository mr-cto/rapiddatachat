import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { getPrismaClient } from "../../../lib/prisma/replicaClient";
import { FileStatus } from "../../../lib/fileIngestion";

// Size threshold for large files (150MB in bytes)
const LARGE_FILE_THRESHOLD = 150 * 1024 * 1024;

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

  try {
    const prisma = getPrismaClient();

    // Find all files in error state that are larger than the threshold
    const largeErrorFiles = await prisma.file.findMany({
      where: {
        status: "error",
        sizeBytes: {
          gt: LARGE_FILE_THRESHOLD,
        },
      },
    });

    console.log(`Found ${largeErrorFiles.length} large files in error state`);

    // Find all files in error state that are smaller than the threshold and have no error details
    const smallErrorFiles = await prisma.file.findMany({
      where: {
        status: "error",
        sizeBytes: {
          lte: LARGE_FILE_THRESHOLD,
        },
      },
      include: {
        fileErrors: true,
      },
    });

    // Filter to only include files with no error details
    const smallErrorFilesWithNoErrors = smallErrorFiles.filter(
      (file) => file.fileErrors.length === 0
    );

    console.log(
      `Found ${smallErrorFilesWithNoErrors.length} small files in error state with no error details`
    );

    // Find all files with too_large status
    const tooLargeFiles = await prisma.file.findMany({
      where: {
        status: "too_large",
      },
    });

    console.log(`Found ${tooLargeFiles.length} files with too_large status`);

    if (
      largeErrorFiles.length === 0 &&
      smallErrorFilesWithNoErrors.length === 0 &&
      tooLargeFiles.length === 0
    ) {
      return res.status(200).json({
        success: true,
        message: "No files to update",
        updatedCount: 0,
      });
    }

    // Update large files to ACTIVE status
    const largeFileUpdateResults = await Promise.all(
      largeErrorFiles.map(async (file) => {
        try {
          const updatedFile = await prisma.file.update({
            where: { id: file.id },
            data: {
              status: "active",
              activationError: null,
            },
          });
          return {
            id: file.id,
            success: true,
            file: updatedFile,
            type: "large",
          };
        } catch (error) {
          console.error(`Error updating file ${file.id}:`, error);
          return { id: file.id, success: false, error, type: "large" };
        }
      })
    );

    // Update small files with no errors to ACTIVE status
    const smallFileUpdateResults = await Promise.all(
      smallErrorFilesWithNoErrors.map(async (file) => {
        try {
          const updatedFile = await prisma.file.update({
            where: { id: file.id },
            data: {
              status: FileStatus.ACTIVE,
              activationError: null,
            },
          });
          return {
            id: file.id,
            success: true,
            file: updatedFile,
            type: "small",
          };
        } catch (error) {
          console.error(`Error updating file ${file.id}:`, error);
          return { id: file.id, success: false, error, type: "small" };
        }
      })
    );

    // Update too_large files to ACTIVE status
    const tooLargeFileUpdateResults = await Promise.all(
      tooLargeFiles.map(async (file) => {
        try {
          const updatedFile = await prisma.file.update({
            where: { id: file.id },
            data: {
              status: "active",
              activationError: null,
            },
          });
          return {
            id: file.id,
            success: true,
            file: updatedFile,
            type: "too_large",
          };
        } catch (error) {
          console.error(`Error updating file ${file.id}:`, error);
          return { id: file.id, success: false, error, type: "too_large" };
        }
      })
    );

    // Combine results
    const allUpdateResults = [
      ...largeFileUpdateResults,
      ...smallFileUpdateResults,
      ...tooLargeFileUpdateResults,
    ];

    // Count successful updates
    const successCount = allUpdateResults.filter(
      (result) => result.success
    ).length;

    // Count successful updates by type
    const largeSuccessCount = largeFileUpdateResults.filter(
      (result) => result.success
    ).length;

    const smallSuccessCount = smallFileUpdateResults.filter(
      (result) => result.success
    ).length;

    const tooLargeSuccessCount = tooLargeFileUpdateResults.filter(
      (result) => result.success
    ).length;

    await prisma.$disconnect();

    return res.status(200).json({
      success: true,
      message: `Updated ${largeSuccessCount} large files, ${smallSuccessCount} small files, and ${tooLargeSuccessCount} too_large files to ACTIVE status`,
      updatedFiles: allUpdateResults
        .filter((result) => result.success)
        .map((result) => result.id),
      failedFiles: allUpdateResults
        .filter((result) => !result.success)
        .map((result) => result.id),
    });
  } catch (error) {
    console.error("Error updating files status:", error);
    return res.status(500).json({
      error: "Failed to update files status",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

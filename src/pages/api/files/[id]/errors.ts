import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../../../../../lib/authOptions";

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

  try {
    const { id } = req.query;
    const fileId = Array.isArray(id) ? id[0] : id;

    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    // Get Prisma client
    const prisma = getPrismaClient();

    // Get file to verify ownership
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // In development, skip ownership check
    if (!isDevelopment) {
      // Verify that the file belongs to the current user
      if (file.userId !== session?.user?.email) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    // Get file errors
    const errors = await prisma.fileError.findMany({
      where: { fileId },
      orderBy: { timestamp: "desc" },
    });

    return res.status(200).json({
      fileId,
      errors,
    });
  } catch (error) {
    console.error("Error fetching file errors:", error);
    return res.status(500).json({
      error: "Failed to fetch file errors",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

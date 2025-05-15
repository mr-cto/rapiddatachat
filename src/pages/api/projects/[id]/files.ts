import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../lib/authOptions";
import { ProjectService } from "../../../../../lib/project/projectService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  const isDevelopment = process.env.NODE_ENV === "development";

  if ((!session || !session.user) && !isDevelopment) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Use a default user email for development
  // Check for test user email header (for testing purposes only)
  const testUserEmail = isDevelopment ? req.headers["x-test-user-email"] : null;
  const userEmail =
    session?.user?.email || (isDevelopment ? "dev@example.com" : "");
  const userId = testUserEmail ? String(testUserEmail) : userEmail || "unknown";

  // Get project ID from URL
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid project ID" });
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get project by ID
    const projectService = new ProjectService();
    const project = await projectService.getProjectById(id);

    // Check if project exists
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if project belongs to user
    if (project.userId !== userId) {
      return res.status(403).json({
        error: "Forbidden - You don't have permission to access this project",
      });
    }

    // Get pagination parameters from query
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 10;
    const sortBy = (req.query.sortBy as string) || "uploadedAt";
    const sortDirection = (req.query.sortDirection as "asc" | "desc") || "desc";

    // Get files for the project with pagination
    const files = await projectService.getProjectFiles(id);

    // Apply manual pagination since we don't have a paginated method in the service
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedFiles = files.slice(startIndex, endIndex);

    // Convert any BigInt values to numbers before serializing to JSON
    const safeFiles = paginatedFiles.map((file) => {
      const safeFile = { ...file };
      // Convert any BigInt properties to regular numbers
      Object.keys(safeFile).forEach((key) => {
        if (typeof safeFile[key] === "bigint") {
          safeFile[key] = Number(safeFile[key]);
        }
        // Also check nested objects like _count
        if (safeFile[key] && typeof safeFile[key] === "object") {
          Object.keys(safeFile[key]).forEach((nestedKey) => {
            if (typeof safeFile[key][nestedKey] === "bigint") {
              safeFile[key][nestedKey] = Number(safeFile[key][nestedKey]);
            }
          });
        }
      });
      return safeFile;
    });

    // Create pagination info
    const pagination = {
      page,
      pageSize,
      totalCount: files.length,
      totalPages: Math.ceil(files.length / pageSize),
    };

    // Return files with BigInt values converted to numbers and pagination info
    return res.status(200).json({
      files: safeFiles,
      pagination,
    });
  } catch (error) {
    console.error(`Error getting files for project ${id}:`, error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

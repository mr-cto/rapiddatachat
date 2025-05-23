import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { v4 as uuidv4 } from "uuid";
import { executeQuery } from "../../../lib/database";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import {
  ensureDirectoriesExist,
  UPLOADS_DIR,
  PROCESSED_DIR,
  generateFilePath,
} from "../../../lib/fileUtils";

// Define chunk-related functions that are missing from fileUtils
interface ChunkMetadata {
  fileId: string;
  totalChunks: number;
  currentChunk: number;
  originalFilename: string;
  userId?: string;
  projectId?: string | null;
}

// Save a chunk to disk
function saveChunk(
  fileId: string,
  chunkIndex: number,
  data: Buffer,
  userId: string = "unknown",
  projectId: string | null = null
): void {
  // Generate the folder path
  const folderPath = generateFilePath(userId, projectId, fileId, "chunks");
  const chunkDir = path.join(UPLOADS_DIR, folderPath);

  if (!fs.existsSync(chunkDir)) {
    fs.mkdirSync(chunkDir, { recursive: true });
  }
  fs.writeFileSync(path.join(chunkDir, `${chunkIndex}`), data);
}

// Check if all chunks have been uploaded
function areAllChunksUploaded(
  fileId: string,
  totalChunks: number,
  userId: string = "unknown",
  projectId: string | null = null
): boolean {
  // Generate the folder path
  const folderPath = generateFilePath(userId, projectId, fileId, "chunks");
  const chunkDir = path.join(UPLOADS_DIR, folderPath);

  if (!fs.existsSync(chunkDir)) {
    return false;
  }

  for (let i = 0; i < totalChunks; i++) {
    if (!fs.existsSync(path.join(chunkDir, `${i}`))) {
      return false;
    }
  }

  return true;
}

// Reassemble chunks into a complete file
function reassembleChunks(
  fileId: string,
  originalFilename: string,
  totalChunks: number,
  userId: string = "unknown",
  projectId: string | null = null
): string {
  // Generate the folder paths
  const chunkFolderPath = generateFilePath(userId, projectId, fileId, "chunks");
  const chunkDir = path.join(UPLOADS_DIR, chunkFolderPath);

  const outputFolderPath = generateFilePath(
    userId,
    projectId,
    fileId,
    originalFilename
  );
  const outputDir = path.join(PROCESSED_DIR, path.dirname(outputFolderPath));

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const ext = path.extname(originalFilename);
  const outputPath = path.join(
    PROCESSED_DIR,
    outputFolderPath,
    `${fileId}${ext}`
  );

  const outputStream = fs.createWriteStream(outputPath);

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(chunkDir, `${i}`);
    const chunkData = fs.readFileSync(chunkPath);
    outputStream.write(chunkData);
  }

  outputStream.end();

  return outputPath;
}

import { ProjectService } from "../../../lib/project/projectService";

// Disable the default body parser to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

// Ensure directories exist
ensureDirectoriesExist();

// Define allowed MIME types
const ALLOWED_MIME_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

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
    const userId = userEmail || "unknown";
    const form = formidable({
      maxFiles: 1,
      maxFileSize: 500 * 1024 * 1024, // 500MB per chunk
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      filter: (part) => {
        // Only accept CSV and Excel files
        if (part.mimetype) {
          return ALLOWED_MIME_TYPES.includes(part.mimetype);
        }
        return false;
      },
    });

    // Parse the form data
    const [fields, files] = await form.parse(req);

    // Get chunk metadata
    const fileId = fields.fileId?.[0] || uuidv4();
    const originalFilename = fields.originalFilename?.[0] || "unknown";
    const totalChunks = parseInt(fields.totalChunks?.[0] || "1", 10);
    const currentChunk = parseInt(fields.currentChunk?.[0] || "0", 10);
    const totalSize = parseInt(fields.totalSize?.[0] || "0", 10);
    const mimeType = fields.mimeType?.[0] || "";
    const projectId = fields.projectId?.[0] || null;

    // Validate chunk metadata
    if (
      isNaN(totalChunks) ||
      isNaN(currentChunk) ||
      isNaN(totalSize) ||
      currentChunk < 0 ||
      currentChunk >= totalChunks ||
      totalChunks <= 0 ||
      totalSize <= 0
    ) {
      return res.status(400).json({ error: "Invalid chunk metadata" });
    }

    // Check if files were uploaded
    if (!files.chunk || files.chunk.length === 0) {
      return res.status(400).json({ error: "No chunk uploaded" });
    }

    // Get the uploaded chunk
    const chunk = files.chunk[0];
    const chunkBuffer = fs.readFileSync(chunk.filepath);

    // Save the chunk
    saveChunk(fileId, currentChunk, chunkBuffer, userId, projectId);

    // Clean up the temporary file
    fs.unlinkSync(chunk.filepath);

    // Check if all chunks have been uploaded
    const isComplete = areAllChunksUploaded(
      fileId,
      totalChunks,
      userId,
      projectId
    );

    if (isComplete) {
      // Reassemble the file
      const filePath = reassembleChunks(
        fileId,
        originalFilename,
        totalChunks,
        userId,
        projectId
      );
      const fileSize = fs.statSync(filePath).size;
      const format = originalFilename.split(".").pop() || "";

      // Store file metadata in the database
      const dbFileId = uuidv4();
      const sourceId = uuidv4();

      await executeQuery(`
        INSERT INTO files (
          id, user_id, filename, status, uploaded_at, size_bytes, format, filepath
        ) VALUES (
          '${dbFileId}',
          '${userId}',
          '${originalFilename.replace(/'/g, "''")}',
          'pending',
          CURRENT_TIMESTAMP,
          ${fileSize},
          '${format}',
          '${filePath.replace(/'/g, "''")}'
        )
      `);

      // Store source information
      await executeQuery(`
        INSERT INTO sources (
          id, user_id, name, created_at, file_id
        ) VALUES (
          '${sourceId}',
          '${userId}',
          '${originalFilename.replace(/'/g, "''")}',
          CURRENT_TIMESTAMP,
          '${dbFileId}'
        )
      `);

      // If projectId is provided, associate the file with the project
      if (projectId) {
        const projectService = new ProjectService();
        await projectService.addFileToProject(projectId, dbFileId);
      }

      // Return success response with file information
      return res.status(200).json({
        success: true,
        file: {
          id: dbFileId,
          name: originalFilename,
          size: fileSize,
          status: "pending",
          format,
          projectId: projectId || null,
        },
        message: "File uploaded successfully. Ingestion process started.",
      });
    } else {
      // Return progress response
      return res.status(200).json({
        success: true,
        fileId,
        progress: {
          currentChunk,
          totalChunks,
          percentage: Math.round(((currentChunk + 1) / totalChunks) * 100),
        },
        message: "Chunk uploaded successfully.",
      });
    }
  } catch (error) {
    console.error("Chunk upload error:", error);
    return res.status(500).json({
      error: "Failed to upload chunk",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

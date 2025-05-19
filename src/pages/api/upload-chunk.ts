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
  console.log(`Reassembling ${totalChunks} chunks for file ${fileId}`);

  // Generate the folder paths
  const chunkFolderPath = generateFilePath(userId, projectId, fileId, "chunks");
  const chunkDir = path.join(UPLOADS_DIR, chunkFolderPath);
  console.log(`Chunk directory: ${chunkDir}`);

  // Check if chunk directory exists
  if (!fs.existsSync(chunkDir)) {
    console.error(`Chunk directory does not exist: ${chunkDir}`);
    throw new Error(`Chunk directory not found: ${chunkDir}`);
  }

  // Create a simple output path in the processed directory
  const ext = path.extname(originalFilename);
  const outputDir = path.join(PROCESSED_DIR, userId.replace(/[@.]/g, "_"));

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${fileId}${ext}`);
  console.log(`Output path: ${outputPath}`);

  // Create a write stream for the output file
  const outputStream = fs.createWriteStream(outputPath);

  // Read each chunk and write it to the output file
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(chunkDir, `${i}`);
    console.log(`Reading chunk ${i} from ${chunkPath}`);

    if (!fs.existsSync(chunkPath)) {
      console.error(`Chunk file not found: ${chunkPath}`);
      throw new Error(`Chunk file not found: ${chunkPath}`);
    }

    const chunkData = fs.readFileSync(chunkPath);
    outputStream.write(chunkData);
  }

  // Close the output stream
  outputStream.end();
  console.log(`File reassembled successfully at ${outputPath}`);

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
    console.log("Processing chunk upload for user:", userId);

    // More permissive form configuration for chunks
    const form = formidable({
      maxFiles: 1,
      maxFileSize: 500 * 1024 * 1024, // 500MB per chunk
      // Don't filter chunks by MIME type since they're binary data
      filter: () => true,
    });

    console.log("Formidable initialized, parsing request...");

    // Parse the form data
    const [fields, files] = await form.parse(req);

    console.log("Request parsed successfully");
    console.log("Fields received:", Object.keys(fields).join(", "));
    console.log("Files received:", Object.keys(files).join(", "));

    // Get chunk metadata
    const fileId = fields.fileId?.[0] || uuidv4();
    const originalFilename = fields.originalFilename?.[0] || "unknown";
    const totalChunks = parseInt(fields.totalChunks?.[0] || "1", 10);
    const currentChunk = parseInt(fields.currentChunk?.[0] || "0", 10);
    const totalSize = parseInt(fields.totalSize?.[0] || "0", 10);
    const mimeType = fields.mimeType?.[0] || "";
    const projectId = fields.projectId?.[0] || null;

    console.log("Chunk metadata:", {
      fileId,
      originalFilename,
      currentChunk: `${currentChunk + 1}/${totalChunks}`,
      totalSize,
      mimeType,
      projectId,
    });

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
      console.error("No chunk found in the request");
      console.log("Available files:", JSON.stringify(files));
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
      let filePath;
      try {
        console.log(`Attempting to reassemble chunks for file ${fileId}`);
        filePath = reassembleChunks(
          fileId,
          originalFilename,
          totalChunks,
          userId,
          projectId
        );

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          console.error(`Reassembled file not found at ${filePath}`);
          return res.status(500).json({
            error: "Failed to reassemble file chunks",
            details: `File not found at ${filePath}`,
          });
        }

        console.log(`Successfully reassembled file at ${filePath}`);
      } catch (reassembleError) {
        console.error("Error reassembling chunks:", reassembleError);
        return res.status(500).json({
          error: "Failed to reassemble file chunks",
          details:
            reassembleError instanceof Error
              ? reassembleError.message
              : "Unknown error",
        });
      }

      const fileSize = fs.statSync(filePath).size;
      const format = originalFilename.split(".").pop() || "";
      console.log(
        `Reassembled file size: ${fileSize} bytes, format: ${format}`
      );

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
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );

    // Return a more detailed error response
    return res.status(500).json({
      error: "Failed to upload chunk",
      details: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

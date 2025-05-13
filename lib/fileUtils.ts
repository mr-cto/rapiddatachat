import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Define the uploads directory
export const UPLOADS_DIR = path.join(process.cwd(), "uploads");
export const PROCESSED_DIR = path.join(process.cwd(), "processed");

/**
 * Ensure that the necessary directories exist
 */
export function ensureDirectoriesExist() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  }
}

/**
 * Generate a unique filename
 * @param originalFilename Original filename
 * @returns Unique filename
 */
export function generateUniqueFilename(originalFilename: string): string {
  const timestamp = Date.now();
  const uniqueId = uuidv4().substring(0, 8);
  const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${timestamp}_${uniqueId}_${sanitizedFilename}`;
}

/**
 * Interface for chunk metadata
 */
export interface ChunkMetadata {
  fileId: string;
  originalFilename: string;
  totalChunks: number;
  currentChunk: number;
  totalSize: number;
  mimeType: string;
}

/**
 * Get the temporary directory for storing chunks
 * @param fileId File ID
 * @returns Path to the temporary directory
 */
export function getChunkDirectory(fileId: string): string {
  const chunkDir = path.join(UPLOADS_DIR, `chunks_${fileId}`);
  if (!fs.existsSync(chunkDir)) {
    fs.mkdirSync(chunkDir, { recursive: true });
  }
  return chunkDir;
}

/**
 * Save a chunk to the temporary directory
 * @param fileId File ID
 * @param chunkIndex Chunk index
 * @param chunk Chunk data
 * @returns Path to the saved chunk
 */
export function saveChunk(
  fileId: string,
  chunkIndex: number,
  chunk: Buffer
): string {
  const chunkDir = getChunkDirectory(fileId);
  const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}`);
  fs.writeFileSync(chunkPath, chunk);
  return chunkPath;
}

/**
 * Check if all chunks have been uploaded
 * @param fileId File ID
 * @param totalChunks Total number of chunks
 * @returns True if all chunks have been uploaded
 */
export function areAllChunksUploaded(
  fileId: string,
  totalChunks: number
): boolean {
  const chunkDir = getChunkDirectory(fileId);
  const files = fs.readdirSync(chunkDir);
  return files.length === totalChunks;
}

/**
 * Reassemble chunks into a complete file
 * @param fileId File ID
 * @param originalFilename Original filename
 * @param totalChunks Total number of chunks
 * @returns Path to the reassembled file
 */
export function reassembleChunks(
  fileId: string,
  originalFilename: string,
  totalChunks: number
): string {
  const chunkDir = getChunkDirectory(fileId);
  const outputPath = path.join(
    UPLOADS_DIR,
    generateUniqueFilename(originalFilename)
  );
  const outputStream = fs.createWriteStream(outputPath);

  // Reassemble chunks in order
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(chunkDir, `chunk_${i}`);
    const chunkData = fs.readFileSync(chunkPath);
    outputStream.write(chunkData);
  }

  outputStream.end();

  // Clean up chunks
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(chunkDir, `chunk_${i}`);
    fs.unlinkSync(chunkPath);
  }
  fs.rmdirSync(chunkDir);

  return outputPath;
}

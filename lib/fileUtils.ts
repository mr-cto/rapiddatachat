import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Define paths for file storage
export const UPLOADS_DIR = path.join(process.cwd(), "uploads");
export const PROCESSED_DIR = path.join(process.cwd(), "processed");

// Ensure directories exist
export function ensureDirectoriesExist() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  }
}

// Generate a unique filename
export function generateUniqueFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename);
  const basename = path.basename(originalFilename, ext);
  const sanitizedName = basename.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  const uniqueId = uuidv4().slice(0, 8);

  return `${sanitizedName}_${uniqueId}${ext}`;
}

// Get MIME type from file extension
export function getMimeTypeFromExtension(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();

  switch (ext) {
    case ".csv":
      return "text/csv";
    case ".xls":
      return "application/vnd.ms-excel";
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return null;
  }
}

// Validate file type
export function isValidFileType(filename: string): boolean {
  const mimeType = getMimeTypeFromExtension(filename);
  return mimeType !== null;
}

// Get file size in human-readable format
export function getHumanReadableSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Clean up temporary files
export function cleanupTempFiles(filePaths: string[]): void {
  filePaths.forEach((filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Error cleaning up file ${filePath}:`, error);
    }
  });
}

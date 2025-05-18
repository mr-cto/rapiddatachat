import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { put, list, del } from "@vercel/blob";

// Define paths for file storage
export const UPLOADS_DIR =
  process.env.VERCEL === "1"
    ? "/tmp/uploads"
    : path.join(process.cwd(), "uploads");
export const PROCESSED_DIR =
  process.env.VERCEL === "1"
    ? "/tmp/processed"
    : path.join(process.cwd(), "processed");

// Check if we're in a Vercel environment
export const isVercelEnvironment = process.env.VERCEL === "1";

// Ensure directories exist
export function ensureDirectoriesExist() {
  try {
    // Create directories regardless of environment
    // In Vercel, we'll use /tmp which is writable
    if (!fs.existsSync(UPLOADS_DIR)) {
      console.log(`Creating uploads directory: ${UPLOADS_DIR}`);
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    if (!fs.existsSync(PROCESSED_DIR)) {
      console.log(`Creating processed directory: ${PROCESSED_DIR}`);
      fs.mkdirSync(PROCESSED_DIR, { recursive: true });
    }

    console.log(
      `Directories created successfully: ${UPLOADS_DIR}, ${PROCESSED_DIR}`
    );
  } catch (error) {
    console.error("Error creating directories:", error);
    if (isVercelEnvironment) {
      console.error(
        "This may be due to permissions in the Vercel environment."
      );
    }
  }
}

// Upload a file to cloud storage
export async function uploadToCloudStorage(
  file: Buffer | Blob,
  filename: string,
  userId: string = "unknown",
  projectId: string | null = null,
  fileId: string = uuidv4()
): Promise<string> {
  // Generate the folder path
  const folderPath = generateFilePath(userId, projectId, fileId, filename);
  if (isVercelEnvironment) {
    try {
      // Check if BLOB_READ_WRITE_TOKEN is set
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.warn(
          "BLOB_READ_WRITE_TOKEN is not set. File will be stored in /tmp but may not persist."
        );

        // Fall back to local storage in /tmp with folder structure
        const fullDir = path.join(UPLOADS_DIR, folderPath);

        // Create directory structure if it doesn't exist
        fs.mkdirSync(fullDir, { recursive: true });

        const filePath = path.join(fullDir, filename);
        if (file instanceof Buffer) {
          fs.writeFileSync(filePath, file);
        } else {
          const blobFile = file as Blob;
          const arrayBuffer = await blobFile.arrayBuffer();
          fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
        }
        return filePath;
      }

      // Use Vercel Blob in production with explicit token
      // Include the folder path in the blob key
      const blobKey = path.join(folderPath, filename).replace(/\\/g, "/");
      console.log(`Uploading file to Vercel Blob: ${blobKey}`);
      const blob = await put(blobKey, file, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      console.log(`File uploaded to Vercel Blob: ${blob.url}`);
      return blob.url;
    } catch (error) {
      console.error("Error uploading to Vercel Blob:", error);

      // Fall back to local storage in /tmp with folder structure
      console.log(`Falling back to local storage in ${UPLOADS_DIR}`);
      const fullDir = path.join(UPLOADS_DIR, folderPath);

      // Create directory structure if it doesn't exist
      fs.mkdirSync(fullDir, { recursive: true });

      const filePath = path.join(fullDir, filename);
      if (file instanceof Buffer) {
        fs.writeFileSync(filePath, file);
      } else {
        const blobFile = file as Blob;
        const arrayBuffer = await blobFile.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
      }
      return filePath;
    }
  } else {
    // In development, save to local filesystem with folder structure
    const fullDir = path.join(UPLOADS_DIR, folderPath);

    // Create directory structure if it doesn't exist
    fs.mkdirSync(fullDir, { recursive: true });

    const filePath = path.join(fullDir, filename);
    if (file instanceof Buffer) {
      fs.writeFileSync(filePath, file);
    } else {
      // For Blob objects, we need to handle them differently
      // This is a type guard to ensure TypeScript knows we're dealing with a Blob
      const blobFile = file as Blob;
      const arrayBuffer = await blobFile.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    }
    return filePath;
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

// Generate a path based on user ID, project ID, and file ID
export function generateFilePath(
  userId: string,
  projectId: string | null,
  fileId: string,
  filename: string
): string {
  // Sanitize user ID (remove special characters and convert to lowercase)
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();

  // Create the path components
  const userDir = sanitizedUserId || "unknown_user";
  const projectDir = projectId ? projectId : "no_project";

  // Create the full path
  const relativePath = path.join(userDir, projectDir, fileId);

  return relativePath;
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
export async function cleanupTempFiles(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    try {
      if (isVercelEnvironment) {
        // Delete from Vercel Blob if it's a URL
        if (filePath.startsWith("http")) {
          console.log(`Deleting file from Vercel Blob: ${filePath}`);
          if (process.env.BLOB_READ_WRITE_TOKEN) {
            await del(filePath, { token: process.env.BLOB_READ_WRITE_TOKEN });
            console.log(`Successfully deleted from Vercel Blob: ${filePath}`);
          } else {
            console.warn(
              `Cannot delete from Vercel Blob: BLOB_READ_WRITE_TOKEN not set`
            );
          }
        }
        // Also try to delete from /tmp if it exists
        else if (fs.existsSync(filePath)) {
          console.log(`Deleting file from /tmp: ${filePath}`);
          fs.unlinkSync(filePath);
          console.log(`Successfully deleted from /tmp: ${filePath}`);
        }
      } else {
        // Delete from local filesystem
        if (fs.existsSync(filePath)) {
          console.log(`Deleting file from local filesystem: ${filePath}`);
          fs.unlinkSync(filePath);
          console.log(`Successfully deleted file: ${filePath}`);
        }
      }
    } catch (error) {
      console.error(`Error cleaning up file ${filePath}:`, error);
      console.error(
        `Error details: ${error instanceof Error ? error.message : "Unknown"}`
      );
    }
  }
}

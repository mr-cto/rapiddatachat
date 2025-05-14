import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { v4 as uuidv4 } from "uuid";
import { executeQuery } from "../../../lib/database";
import formidable, { File as FormidableFile } from "formidable";
import {
  UPLOADS_DIR,
  ensureDirectoriesExist,
  generateUniqueFilename,
} from "../../../lib/fileUtils";
import { ProjectService } from "../../../lib/project/projectService";
// Removed import for fileActivationSimple

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
      maxFiles: 5,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      uploadDir: UPLOADS_DIR,
      keepExtensions: true,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      filename: (name, ext, _) => {
        return generateUniqueFilename(name + ext);
      },
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

    // Check if files were uploaded
    if (!files.file || files.file.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // Get the project ID from the form data
    const projectId = Array.isArray(fields.projectId)
      ? fields.projectId[0]
      : fields.projectId;

    // If projectId is provided, check if the project exists and belongs to the user
    if (projectId) {
      const projectService = new ProjectService();
      const project = await projectService.getProjectById(projectId);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (project.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    // Process each file
    const fileResults = await Promise.all(
      files.file.map(async (file: FormidableFile) => {
        const fileId = uuidv4();
        const sourceId = uuidv4();
        const originalFilename = file.originalFilename || "unknown";
        const format = originalFilename.split(".").pop() || "";
        // Get mime type but don't use it yet - will be used in future features
        // const mimeType = getMimeTypeFromExtension(originalFilename) || "";

        let dbOperationSuccess = true;

        try {
          // Store file metadata in the database
          await executeQuery(`
            INSERT INTO files (
              id, user_id, filename, status, uploaded_at, size_bytes, format, filepath
            ) VALUES (
              '${fileId}',
              '${userId}',
              '${originalFilename.replace(/'/g, "''")}',
              'pending',
              CURRENT_TIMESTAMP,
              ${file.size},
              '${format}',
              '${file.filepath.replace(/'/g, "''")}'
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
              '${fileId}'
            )
          `);

          // If projectId is provided, associate the file with the project
          if (projectId) {
            const projectService = new ProjectService();
            await projectService.addFileToProject(projectId, fileId);
          }
        } catch (dbError) {
          // Check if this is a DuckDB server environment error
          if (
            dbError instanceof Error &&
            (dbError.message.includes(
              "DuckDB is only available in browser environments"
            ) ||
              dbError.message.includes("Worker is not defined") ||
              dbError.message ===
                "DuckDB is not available in server environments")
          ) {
            console.warn(
              "DuckDB operations skipped (server environment): Continuing with file upload without database operations"
            );
            console.warn(
              "Please make sure PostgreSQL is running. See README.md for setup instructions."
            );
          } else {
            console.error("DuckDB operations failed:", dbError);
          }
          dbOperationSuccess = false;
        }

        // Return file information
        return {
          id: fileId,
          name: originalFilename,
          size: file.size,
          status: "pending",
          format,
          path: file.filepath,
          dbOperationSuccess,
          projectId: projectId || null,
        };
      })
    );

    // Check if any database operations failed
    const anyDbOperationFailed = fileResults.some(
      (file) => !file.dbOperationSuccess
    );

    // Return success response with file information
    const response = {
      success: true,
      files: fileResults.map((file) => ({
        id: file.id,
        name: file.name,
        size: file.size,
        status: file.status,
        format: file.format,
        projectId: file.projectId,
      })),
      message: anyDbOperationFailed
        ? "Files uploaded successfully, but database operations were skipped. The application may have limited functionality."
        : "Files uploaded successfully. Ingestion process started.",
      dbOperationsSkipped: anyDbOperationFailed,
    };

    // Send the response
    res.status(200).json(response);

    // Process files asynchronously
    processFilesAsync(fileResults, req.headers.cookie || "", userId);

    return;
  } catch (error) {
    console.error("File upload error:", error);
    return res.status(500).json({
      error: "Failed to upload files",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Process files asynchronously (ingest and auto-activate)
 * @param files Array of file information
 * @param cookie Cookie header for authentication
 * @param userIdFromUpload User ID from the upload context
 */
async function processFilesAsync(
  files: Array<{
    id: string;
    name: string;
    size: number;
    status: string;
    format: string;
    path: string;
    dbOperationSuccess: boolean;
    projectId: string | null;
  }>,
  cookie: string,
  userIdFromUpload: string
): Promise<void> {
  // Process each file
  for (const file of files) {
    try {
      // Wait a short delay to ensure the file is saved to disk
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log(`Starting ingestion for file ${file.id}`);

      // Call the ingest-file API endpoint
      const ingestResponse = await fetch(
        `${
          process.env.NEXTAUTH_URL || "http://localhost:3000"
        }/api/ingest-file`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Pass the session cookie for authentication
            Cookie: cookie,
          },
          body: JSON.stringify({
            fileId: file.id,
            projectId: file.projectId,
          }),
        }
      );

      if (!ingestResponse.ok) {
        try {
          // Try to parse as JSON first
          const contentType = ingestResponse.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await ingestResponse.json();
            console.error(`Error ingesting file ${file.id}:`, errorData);
          } else {
            // If not JSON, get the text response
            const errorText = await ingestResponse.text();
            console.error(
              `Error ingesting file ${file.id}: Non-JSON response:`,
              errorText.substring(0, 200) +
                (errorText.length > 200 ? "..." : "")
            );
          }
        } catch (parseError) {
          console.error(
            `Error parsing error response for file ${file.id}:`,
            parseError
          );
        }
        continue;
      }

      console.log(`Successfully ingested file ${file.id}`);

      // After successful ingestion, automatically activate the file
      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        // Auto-activate the file directly
        await executeQuery(`
          UPDATE files
          SET status = 'active'
          WHERE id = '${file.id}'
        `);
        console.log(`Successfully auto-activated file ${file.id}`);
      } catch (activationError) {
        console.error(
          `Error auto-activating file ${file.id}:`,
          activationError
        );
      }
    } catch (error) {
      console.error(`Error processing file ${file.id}:`, error);
    }
  }
}
